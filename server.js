// Tally — a tiny ledger app
// Node.js server with MongoDB database
// Data is stored in MongoDB Atlas (free tier)

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

// MongoDB setup
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tally';
const client = new MongoClient(mongoUri);
let db, entriesCollection;

async function connectDB() {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('ERROR: MONGODB_URI environment variable not set');
      console.error('Please set MONGODB_URI in your deployment environment');
      return false;
    }
    
    await client.connect();
    db = client.db();
    entriesCollection = db.collection('entries');
    console.log('Connected to MongoDB successfully');
    return true;
  } catch (err) {
    console.error('MongoDB connection error:', err);
    console.error('Connection string:', mongoUri.replace(/:[^:@]+@/, ':****@'));
    return false;
  }
}

// ---------- database functions ----------

async function loadEntries() {
  if (!entriesCollection) {
    console.error('MongoDB not connected');
    return [];
  }
  try {
    const entries = await entriesCollection.find().sort({ createdAt: -1 }).toArray();
    return entries;
  } catch (err) {
    console.error('Error loading entries:', err);
    return [];
  }
}

async function saveEntry(entry) {
  if (!entriesCollection) {
    console.error('MongoDB not connected');
    throw new Error('Database not connected');
  }
  try {
    await entriesCollection.insertOne(entry);
  } catch (err) {
    console.error('Error saving entry:', err);
    throw err;
  }
}

async function deleteEntry(id) {
  if (!entriesCollection) {
    console.error('MongoDB not connected');
    throw new Error('Database not connected');
  }
  try {
    const result = await entriesCollection.deleteOne({ id });
    return result.deletedCount > 0;
  } catch (err) {
    console.error('Error deleting entry:', err);
    throw err;
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
    const entries = await loadEntries();
    return sendJSON(res, 200, entries);
  }

  // GET /api/balances
  if (req.method === 'GET' && url.pathname === '/api/balances') {
    const entries = await loadEntries();
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
    await saveEntry(entry);
    return sendJSON(res, 201, entry);
  }

  // DELETE /api/entries/:id
  if (req.method === 'DELETE' && url.pathname.startsWith('/api/entries/')) {
    const id = url.pathname.split('/').pop();
    const deleted = await deleteEntry(id);
    if (!deleted) {
      return sendJSON(res, 404, { error: 'Entry not found' });
    }
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

// Start server with MongoDB connection
async function startServer() {
  const connected = await connectDB();
  if (!connected) {
    console.error('Failed to connect to MongoDB. Server will not function properly.');
    console.error('Please check MONGODB_URI environment variable.');
  }
  server.listen(PORT, () => {
    console.log(`Tally is running at http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
