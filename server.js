// Tally — a tiny ledger app
// Node.js server with JSON database
// Data is stored in JSON database

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

// Railway uses PORT environment variable automatically
// Ensure we're listening on 0.0.0.0 for Railway

// Database setup
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'db.json');

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// ---------- database functions ----------

function loadEntries() {
  try {
    const raw = fs.readFileSync(dbPath, 'utf8');
    const data = JSON.parse(raw);
    return data.entries || [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    console.error('Error loading entries:', err);
    return [];
  }
}

function saveEntries(entries) {
  try {
    const data = { entries };
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving entries:', err);
    throw err;
  }
}

function saveEntry(entry) {
  const entries = loadEntries();
  entries.push(entry);
  saveEntries(entries);
}

function deleteEntry(id) {
  const entries = loadEntries();
  const filtered = entries.filter((e) => e.id !== id);
  if (filtered.length !== entries.length) {
    saveEntries(filtered);
  }
}

function computeBalances(entries) {
  // Positive balance  = this person is, on net, owed money.
  // Negative balance   = this person, on net, owes money.
  const balances = {};
  const bump = (name, delta) => {
    balances[name] = (balances[name] || 0) + delta;
  };
  for (const e of entries) {
    bump(e.creditor, e.amount);   // creditor is owed / paid out -> credited
    bump(e.debitor, -e.amount);   // debitor owes -> debited
  }
  // round to 2dp to avoid floating point dust
  for (const k of Object.keys(balances)) {
    balances[k] = Math.round(balances[k] * 100) / 100;
  }
  return balances;
}

// ---------- request helpers ----------

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = '';
    req.on('data', (c) => {
      chunks += c;
      if (chunks.length > 1e6) req.destroy(); // 1MB guard
    });
    req.on('end', () => {
      if (!chunks) return resolve({});
      try {
        resolve(JSON.parse(chunks));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function serveStatic(req, res, urlPath) {
  let filePath = urlPath === '/' ? '/index.html' : urlPath;
  filePath = path.join(PUBLIC_DIR, filePath);

  // prevent path traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

// ---------- API ----------

async function handleApi(req, res, url) {
  // GET /api/entries
  if (req.method === 'GET' && url.pathname === '/api/entries') {
    const entries = loadEntries();
    entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sendJSON(res, 200, entries);
  }

  // GET /api/balances
  if (req.method === 'GET' && url.pathname === '/api/balances') {
    const entries = loadEntries();
    return sendJSON(res, 200, computeBalances(entries));
  }

  // POST /api/entries  { amount, creditor, debitor, note }
  if (req.method === 'POST' && url.pathname === '/api/entries') {
    let body;
    try {
      body = await readBody(req);
    } catch {
      return sendJSON(res, 400, { error: 'Invalid JSON body' });
    }

    const amount = Number(body.amount);
    const creditor = String(body.creditor || '').trim();
    const debitor = String(body.debitor || '').trim();
    const note = String(body.note || '').trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      return sendJSON(res, 400, { error: 'Amount must be a positive number' });
    }
    if (!creditor || !debitor) {
      return sendJSON(res, 400, { error: 'Both creditor and debitor are required' });
    }
    if (creditor.toLowerCase() === debitor.toLowerCase()) {
      return sendJSON(res, 400, { error: 'Creditor and debitor must be different people' });
    }

    const entry = {
      id: crypto.randomUUID(),
      amount: Math.round(amount * 100) / 100,
      creditor,
      debitor,
      note,
      createdAt: new Date().toISOString(),
    };
    saveEntry(entry);
    return sendJSON(res, 201, entry);
  }

  // DELETE /api/entries/:id
  if (req.method === 'DELETE' && url.pathname.startsWith('/api/entries/')) {
    const id = url.pathname.split('/').pop();
    const entries = loadEntries();
    const before = entries.length;
    const filtered = entries.filter((e) => e.id !== id);
    if (filtered.length === before) {
      return sendJSON(res, 404, { error: 'Entry not found' });
    }
    saveEntries(filtered);
    return sendJSON(res, 200, { ok: true });
  }

  return sendJSON(res, 404, { error: 'Not found' });
}

// ---------- server ----------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith('/api/')) {
    try {
      await handleApi(req, res, url);
    } catch (err) {
      console.error(err);
      sendJSON(res, 500, { error: 'Internal server error' });
    }
    return;
  }

  serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`Tally is running at http://localhost:${PORT}`);
});
