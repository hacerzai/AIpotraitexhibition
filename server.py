import json
import os
import time
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 3000
CREATE_URL = 'https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions'
TOKEN_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'replicate_token.txt')


def load_token():
    try:
        with open(TOKEN_FILE, 'r', encoding='utf-8') as file:
            token = file.read().strip()
    except FileNotFoundError:
        raise RuntimeError('Replicate token file is missing. Close this window and run START_APP.bat again.')

    if not token.startswith('r8_') or len(token) < 20:
        raise RuntimeError('The saved Replicate token is invalid. Delete replicate_token.txt and run START_APP.bat again.')
    return token


def api_request(url, method='GET', payload=None):
    token = load_token()
    data = json.dumps(payload).encode('utf-8') if payload is not None else None
    request = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
            'Prefer': 'wait=60',
            'User-Agent': 'AI-Portrait-Exhibition/1.0'
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            raw = response.read().decode('utf-8')
            return response.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        raw = error.read().decode('utf-8', errors='replace')
        try:
            details = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            details = {'error': raw or f'HTTP {error.code}'}
        return error.code, details


class PortraitHandler(SimpleHTTPRequestHandler):
    def send_json(self, status, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != '/generate':
            self.send_json(404, {'error': 'Not found'})
            return

        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length <= 0 or length > 12_000_000:
                self.send_json(400, {'error': 'Invalid or oversized request.'})
                return

            payload = json.loads(self.rfile.read(length).decode('utf-8'))
            image = payload.get('image')
            prompt = payload.get('prompt')
            if not image or not prompt:
                self.send_json(400, {'error': 'Image and prompt are required.'})
                return

            status, prediction = api_request(
                CREATE_URL,
                method='POST',
                payload={
                    'input': {
                        'input_image': image,
                        'prompt': prompt,
                        'aspect_ratio': '3:4',
                        'output_format': 'webp',
                        'safety_tolerance': 2
                    }
                },
            )

            if status >= 400:
                message = prediction.get('detail') or prediction.get('error') or f'Replicate failed (HTTP {status}).'
                if isinstance(message, list):
                    message = '; '.join(str(item.get('msg', item)) if isinstance(item, dict) else str(item) for item in message)
                self.send_json(status, {'error': str(message)})
                return

            checks = 0
            while prediction.get('status') not in ('succeeded', 'failed', 'canceled') and checks < 45:
                time.sleep(1.5)
                poll_url = prediction.get('urls', {}).get('get')
                if not poll_url:
                    break
                poll_status, prediction = api_request(poll_url)
                if poll_status >= 400:
                    self.send_json(poll_status, {'error': prediction.get('detail') or prediction.get('error') or 'Polling failed.'})
                    return
                checks += 1

            if prediction.get('status') != 'succeeded':
                self.send_json(500, {'error': prediction.get('error') or 'Generation timed out or failed.'})
                return

            output = prediction.get('output')
            image_url = output[0] if isinstance(output, list) and output else output
            if not image_url:
                self.send_json(500, {'error': 'Replicate returned no image.'})
                return

            self.send_json(200, {'url': image_url})
        except json.JSONDecodeError:
            self.send_json(400, {'error': 'Invalid request data.'})
        except urllib.error.URLError as error:
            self.send_json(502, {'error': f'Internet connection failed: {error.reason}'})
        except Exception as error:
            print('Generation error:', error)
            self.send_json(500, {'error': str(error) or 'Generation failed.'})


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    try:
        load_token()
    except RuntimeError as error:
        print(f'\nERROR: {error}\n')
        input('Press Enter to close...')
        raise SystemExit(1)

    server = ThreadingHTTPServer(('127.0.0.1', PORT), PortraitHandler)
    print('\nAI Portrait Exhibition is running!')
    print(f'Open this address in Chrome or Edge: http://localhost:{PORT}')
    print('Keep this window open during the exhibition.\n')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServer stopped.')
        server.server_close()
