// Migration script: Import data.json into db.json
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'db.json');
const dataPath = path.join(__dirname, 'data.json');

// Load existing data
try {
  const raw = fs.readFileSync(dataPath, 'utf8');
  const entries = JSON.parse(raw);
  
  if (entries.length === 0) {
    console.log('No entries to migrate.');
  } else {
    const data = { entries };
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    console.log(`Migrated ${entries.length} entries to db.json.`);
  }
} catch (err) {
  if (err.code === 'ENOENT') {
    console.log('No data.json file found. Starting with empty database.');
  } else {
    console.error('Error migrating data:', err.message);
  }
}
