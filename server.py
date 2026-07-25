import base64
import binascii
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get('PORT', '3000'))
HOST = os.environ.get('HOST', '0.0.0.0')
REPLICATE_CREATE_URL = 'https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions'
CLOUDFLARE_MODEL = '@cf/black-forest-labs/flux-2-klein-4b'
TOKEN_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'replicate_token.txt')


class ProviderError(RuntimeError):
    pass


def load_replicate_token():
    token = os.environ.get('REPLICATE_API_TOKEN', '').strip()

    if not token:
        try:
            with open(TOKEN_FILE, 'r', encoding='utf-8') as file:
                token = file.read().strip()
        except FileNotFoundError:
            raise ProviderError(
                'Replicate token is missing. On Render, add REPLICATE_API_TOKEN as an environment variable.'
            )

    if not token.startswith('r8_') or len(token) < 20:
        raise ProviderError('The Replicate token is invalid.')
    return token


def load_cloudflare_credentials():
    token = os.environ.get('CLOUDFLARE_API_TOKEN', '').strip()
    account_id = os.environ.get('CLOUDFLARE_ACCOUNT_ID', '').strip()
    if not token or not account_id:
        raise ProviderError(
            'Cloudflare backup is not configured. Add CLOUDFLARE_API_TOKEN and '
            'CLOUDFLARE_ACCOUNT_ID in Render.'
        )
    return token, account_id


def decode_data_url(data_url):
    if not isinstance(data_url, str) or ',' not in data_url:
        raise ProviderError('The backup image is invalid.')

    header, encoded = data_url.split(',', 1)
    if ';base64' not in header:
        raise ProviderError('The backup image must be Base64 encoded.')

    mime_type = header[5:].split(';', 1)[0].lower()
    if mime_type not in ('image/jpeg', 'image/png', 'image/webp'):
        raise ProviderError('The backup image format is not supported.')

    try:
        image_bytes = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as error:
        raise ProviderError('The backup image data is invalid.') from error

    if not image_bytes or len(image_bytes) > 4_000_000:
        raise ProviderError('The backup image is empty or too large.')
    return mime_type, image_bytes


def encode_multipart(fields, files):
    boundary = f'----InsightPortrait{uuid.uuid4().hex}'
    body = bytearray()

    for name, value in fields.items():
        body.extend(f'--{boundary}\r\n'.encode())
        body.extend(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        body.extend(str(value).encode('utf-8'))
        body.extend(b'\r\n')

    for name, filename, mime_type, content in files:
        body.extend(f'--{boundary}\r\n'.encode())
        body.extend(
            f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode()
        )
        body.extend(f'Content-Type: {mime_type}\r\n\r\n'.encode())
        body.extend(content)
        body.extend(b'\r\n')

    body.extend(f'--{boundary}--\r\n'.encode())
    return bytes(body), f'multipart/form-data; boundary={boundary}'


def read_http_error(error):
    raw = error.read().decode('utf-8', errors='replace')
    try:
        return json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        return {'error': raw or f'HTTP {error.code}'}


def provider_message(payload, default):
    if not isinstance(payload, dict):
        return default

    message = payload.get('detail') or payload.get('error')
    if not message:
        errors = payload.get('errors')
        if isinstance(errors, list) and errors:
            first = errors[0]
            message = first.get('message') if isinstance(first, dict) else first

    if isinstance(message, list):
        message = '; '.join(
            str(item.get('msg', item)) if isinstance(item, dict) else str(item)
            for item in message
        )
    return str(message or default)


def replicate_request(url, method='GET', payload=None):
    token = load_replicate_token()
    data = json.dumps(payload).encode('utf-8') if payload is not None else None
    request = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
            'Prefer': 'wait=60',
            'User-Agent': 'AI-Portrait-Booth/2.0'
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            raw = response.read().decode('utf-8')
            return response.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        return error.code, read_http_error(error)


def generate_with_replicate(image, prompt):
    status, prediction = replicate_request(
        REPLICATE_CREATE_URL,
        method='POST',
        payload={
            'input': {
                'input_image': image,
                'prompt': prompt,
                'aspect_ratio': '3:4',
                'output_format': 'png',
                'safety_tolerance': 2
            }
        },
    )
    if status >= 400:
        raise ProviderError(provider_message(prediction, f'Replicate failed (HTTP {status}).'))

    checks = 0
    while prediction.get('status') not in ('succeeded', 'failed', 'canceled') and checks < 45:
        time.sleep(1.5)
        poll_url = prediction.get('urls', {}).get('get')
        if not poll_url:
            break
        poll_status, prediction = replicate_request(poll_url)
        if poll_status >= 400:
            raise ProviderError(provider_message(prediction, 'Replicate polling failed.'))
        checks += 1

    if prediction.get('status') != 'succeeded':
        raise ProviderError(prediction.get('error') or 'Replicate generation timed out or failed.')

    output = prediction.get('output')
    image_url = output[0] if isinstance(output, list) and output else output
    if not image_url:
        raise ProviderError('Replicate returned no image.')
    return image_url


def generate_with_cloudflare(image, prompt):
    token, account_id = load_cloudflare_credentials()
    mime_type, image_bytes = decode_data_url(image)
    extension = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'}[mime_type]
    body, content_type = encode_multipart(
        {'prompt': prompt, 'width': '768', 'height': '1024'},
        [('input_image_0', f'portrait.{extension}', mime_type, image_bytes)],
    )
    model_path = urllib.parse.quote(CLOUDFLARE_MODEL, safe='@/-')
    url = f'https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model_path}'
    request = urllib.request.Request(
        url,
        data=body,
        method='POST',
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': content_type,
            'User-Agent': 'AI-Portrait-Booth/2.0'
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            raw = response.read().decode('utf-8')
            payload = json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        payload = read_http_error(error)
        raise ProviderError(provider_message(payload, f'Cloudflare failed (HTTP {error.code}).')) from error

    if not payload.get('success', False):
        raise ProviderError(provider_message(payload, 'Cloudflare backup generation failed.'))

    result = payload.get('result') or {}
    encoded_image = result.get('image') if isinstance(result, dict) else None
    if not encoded_image:
        raise ProviderError('Cloudflare returned no image.')
    return f'data:image/png;base64,{encoded_image}'


def provider_status():
    providers = {}
    try:
        load_replicate_token()
        providers['replicate'] = True
    except ProviderError:
        providers['replicate'] = False
    try:
        load_cloudflare_credentials()
        providers['cloudflare'] = True
    except ProviderError:
        providers['cloudflare'] = False
    return providers


class PortraitHandler(SimpleHTTPRequestHandler):
    def send_json(self, status, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == '/health':
            providers = provider_status()
            status = 200 if any(providers.values()) else 503
            self.send_json(status, {'status': 'ok' if status == 200 else 'error', 'providers': providers})
            return
        super().do_GET()

    def do_POST(self):
        if self.path != '/generate':
            self.send_json(404, {'error': 'Not found'})
            return

        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length <= 0 or length > 14_000_000:
                self.send_json(400, {'error': 'Invalid or oversized request.'})
                return

            payload = json.loads(self.rfile.read(length).decode('utf-8'))
            image = payload.get('image')
            fallback_image = payload.get('fallbackImage') or image
            prompt = payload.get('prompt')
            if not image or not prompt:
                self.send_json(400, {'error': 'Image and prompt are required.'})
                return

            try:
                image_url = generate_with_replicate(image, prompt)
                provider = 'replicate'
            except Exception as replicate_error:
                print(f'Replicate unavailable; using Cloudflare backup: {replicate_error}')
                try:
                    image_url = generate_with_cloudflare(fallback_image, prompt)
                    provider = 'cloudflare'
                except Exception as cloudflare_error:
                    print(f'Cloudflare backup failed: {cloudflare_error}')
                    self.send_json(
                        502,
                        {
                            'error': (
                                'Both portrait services are unavailable. '
                                f'Primary: {replicate_error} Backup: {cloudflare_error}'
                            )
                        },
                    )
                    return

            self.send_json(200, {'url': image_url, 'provider': provider})
        except json.JSONDecodeError:
            self.send_json(400, {'error': 'Invalid request data.'})
        except Exception as error:
            print('Generation error:', error)
            self.send_json(500, {'error': str(error) or 'Generation failed.'})


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    providers = provider_status()
    if not any(providers.values()):
        print(
            '\nERROR: No AI provider is configured. Add REPLICATE_API_TOKEN, or add both '
            'CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.\n'
        )
        if os.environ.get('RENDER') != 'true':
            input('Press Enter to close...')
        raise SystemExit(1)

    server = ThreadingHTTPServer((HOST, PORT), PortraitHandler)
    print('\nAI Portrait Booth is running!')
    print(f'Listening on http://{HOST}:{PORT}')
    print(f'Providers: {providers}')
    print('Keep this process running.\n')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServer stopped.')
        server.server_close()
