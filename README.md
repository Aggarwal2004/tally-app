# Tally

A very simple ledger app. Log who paid for what, who owes whom, and see running
balances — automatically added and subtracted for you.

## Run it locally

```bash
npm install
node server.js
```

Then open **http://localhost:3000** in your browser.

Data is stored in `db.json` using LowDB for persistent storage.

Want a different port?

```bash
PORT=4000 node server.js
```

## How it works

- **Add an entry**: amount, who paid (creditor), who owes (debitor), optional note.
- **Balances**: for every entry, the creditor's balance goes up by the amount and
  the debitor's goes down by the same amount. Add it all up across every entry and
  you get each person's net position — green if they're owed money, red if they
  owe, grey if they're settled up.
- **Ledger**: every entry ever added, newest first. Click the ✕ to delete one.

## Project structure

```
tally-app/
├── server.js         # Node.js backend with LowDB — REST API + static file server
├── db.json           # your data lives here (starts empty)
├── index.html        # Dashboard page
├── entry.html        # New entry page
├── ledger.html       # Ledger page
├── balances.html     # Balances page
├── style.css         # Professional styling
├── app.js            # Frontend logic
├── package.json      # Dependencies
├── Procfile          # Heroku/Render deployment config
└── README.md
```

## API reference

| Method | Path                | Body                                              | Description               |
|--------|----------------------|----------------------------------------------------|----------------------------|
| GET    | `/api/entries`       | —                                                  | List all entries           |
| POST   | `/api/entries`       | `{ amount, creditor, debitor, note? }`             | Add an entry                |
| DELETE | `/api/entries/:id`   | —                                                  | Remove an entry             |
| GET    | `/api/balances`      | —                                                  | Net balance per person      |

## Deployment Instructions

### Option 1: Render (Recommended - Free tier with persistent storage)

1. **Create a GitHub repository** with your code
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/tally-app.git
   git push -u origin main
   ```

2. **Sign up for Render** at [render.com](https://render.com)

3. **Create a new Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Build command: `npm install`
   - Start command: `node server.js`
   - Instance type: Free (or paid for better performance)

4. **Add persistent disk** (CRITICAL for data persistence)
   - In your web service settings, go to "Disks"
   - Add a disk named "data" with mount path `/app/data`
   - Set `DATABASE_PATH` environment variable to `/app/data/db.json`

5. **Your app will be live** at `https://your-app-name.onrender.com`

### Option 2: Railway (Limited - No persistent storage on free tier)

Railway's free tier doesn't include persistent storage, so your data will be lost on redeploy. For a production app with persistent data, use Render instead.

If you still want to use Railway:

1. **Create a GitHub repository** (same as above)

2. **Sign up for Railway** at [railway.app](https://railway.app)

3. **Deploy from GitHub**
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Railway will auto-detect Node.js
   - Click "Deploy"

**Warning:** Data will be ephemeral and lost on redeploy unless you upgrade to a paid plan with persistent storage.

### Option 3: VPS (DigitalOcean, Linode, etc.)

1. **Get a VPS** with Node.js installed

2. **Clone your repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/tally-app.git
   cd tally-app
   npm install
   ```

3. **Run with PM2** (for process management)
   ```bash
   npm install -g pm2
   pm2 start server.js --name tally
   pm2 save
   pm2 startup
   ```

4. **Set up nginx** as a reverse proxy (recommended for production)

## Environment Variables

- `PORT`: Server port (default: 3000)
- `DATABASE_PATH`: Path to database file (default: ./db.json)

## Important Notes

- **Data persistence**: Make sure your deployment platform has persistent storage
- **Backups**: Regularly backup your `db.json` file
- **Security**: This is a simple app without authentication - add auth if needed for production
