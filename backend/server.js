const fs = require('fs');
const http = require('http');
const path = require('path');
const { createCareerStore } = require('./careerStore');

const FRONTEND_DIR = path.resolve(__dirname, '..', 'frontend');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 1e6) reject(new Error('Payload too large'));
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
  });
  res.end(body);
}

function createCareerServer({ dataFilePath } = {}) {
  const store = createCareerStore(dataFilePath);

  return http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
      });
      return res.end();
    }

    const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const p = parsed.pathname;

    try {
      if (p === '/api/health' && req.method === 'GET') {
        return sendJson(res, 200, { status: 'ok', service: 'CareerOS API' });
      }
      if (p === '/api/applications' && req.method === 'GET') {
        const items = store.list({
          stage: parsed.searchParams.get('stage'),
          priority: parsed.searchParams.get('priority'),
          q: parsed.searchParams.get('q')
        });
        return sendJson(res, 200, { applications: items });
      }
      if (p === '/api/applications' && req.method === 'POST') {
        const created = store.create(await parseBody(req));
        return sendJson(res, 201, { application: created });
      }
      if (p.startsWith('/api/applications/') && req.method === 'PATCH') {
        const id = p.slice('/api/applications/'.length);
        const updated = store.update(id, await parseBody(req));
        return updated ? sendJson(res, 200, { application: updated }) : sendJson(res, 404, { message: 'Application not found' });
      }
      if (p.startsWith('/api/applications/') && req.method === 'DELETE') {
        const id = p.slice('/api/applications/'.length);
        return store.remove(id) ? sendJson(res, 200, { deleted: true }) : sendJson(res, 404, { message: 'Application not found' });
      }
      if (p === '/api/analytics' && req.method === 'GET') {
        return sendJson(res, 200, store.getAnalytics());
      }
      if (p.startsWith('/api/')) {
        return sendJson(res, 404, { message: 'API route not found' });
      }

      const target = p === '/' ? 'index.html' : p.replace(/^\/+/, '');
      const fullPath = path.resolve(FRONTEND_DIR, target);
      if (!fullPath.startsWith(FRONTEND_DIR) || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('Not Found');
      }
      const ext = path.extname(fullPath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      fs.createReadStream(fullPath).pipe(res);
    } catch (err) {
      sendJson(res, 400, { message: err.message || 'Bad request' });
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 5070);
  const srv = createCareerServer();
  srv.listen(port, () => {
    console.log(`[CareerOS] Server running on http://127.0.0.1:${port}`);
  });
}

module.exports = { createCareerServer };
