const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;
const TOKEN = Buffer.from('cjhfOG5oUHVIcWpQTlhkMkVwQjBBSWNobktCODgxcm1YNTNTSmJtZA==', 'base64').toString('utf8');
const CREATE_URL = 'https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions';

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  return await new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 12_000_000) {
        reject(new Error('Photo is too large.'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function replicateJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; }
  catch { throw new Error(`Replicate returned an unreadable response (${response.status}).`); }

  if (!response.ok) {
    const detail = Array.isArray(data.detail)
      ? data.detail.map(item => item.msg || JSON.stringify(item)).join(', ')
      : data.detail;
    throw new Error(detail || data.error || `Replicate failed (${response.status}).`);
  }
  return data;
}

async function generate(req, res) {
  try {
    const raw = await readBody(req);
    const { image, prompt } = JSON.parse(raw || '{}');
    if (!image || !prompt) return sendJson(res, 400, { error: 'Image and prompt are required.' });

    let prediction = await replicateJson(CREATE_URL, {
      method: 'POST',
      body: JSON.stringify({
        input: {
          input_image: image,
          prompt,
          aspect_ratio: '3:4',
          output_format: 'webp',
          safety_tolerance: 2
        }
      })
    });

    let checks = 0;
    while (!['succeeded', 'failed', 'canceled'].includes(prediction.status) && checks < 60) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      prediction = await replicateJson(prediction.urls.get, { method: 'GET' });
      checks++;
    }

    if (prediction.status !== 'succeeded') {
      throw new Error(prediction.error || 'Generation timed out or failed. Try again.');
    }

    const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    if (!url) throw new Error('Replicate returned no portrait image.');
    return sendJson(res, 200, { url });
  } catch (error) {
    console.error('Generation error:', error);
    return sendJson(res, 500, { error: error.message || 'Generation failed.' });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/generate') return generate(req, res);

  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const file = path.join(__dirname, 'index.html');
    fs.readFile(file, (error, data) => {
      if (error) return sendJson(res, 500, { error: 'index.html could not be opened.' });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(data);
    });
    return;
  }

  sendJson(res, 404, { error: 'Not found.' });
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log('\nAI Portrait Exhibition is running!');
  console.log(`Open: ${url}`);
  console.log('Keep this window open during the exhibition.\n');
  if (process.platform === 'win32') exec(`start "" "${url}"`);
});
