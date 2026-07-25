// Migration script: Import data.json into LowDB database
const fs = require('fs');
const path = require('path');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');

const dbPath = path.join(__dirname, 'db.json');
const dataPath = path.join(__dirname, 'data.json');

const adapter = new JSONFile(dbPath);
const defaultData = { entries: [] };
const db = new Low(adapter, defaultData);

// Initialize database
db.read();
db.data ||= defaultData;

// Load existing data
try {
  const raw = fs.readFileSync(dataPath, 'utf8');
  const entries = JSON.parse(raw);
  
  if (entries.length === 0) {
    console.log('No entries to migrate.');
  } else {
    db.data.entries = entries;
    db.write();
    console.log(`Migrated ${entries.length} entries to LowDB database.`);
  }
} catch (err) {
  if (err.code === 'ENOENT') {
    console.log('No data.json file found. Starting with empty database.');
  } else {
    console.error('Error migrating data:', err.message);
  }
}
