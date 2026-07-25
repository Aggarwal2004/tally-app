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

### Step 1: Set up MongoDB Atlas (Free Database)

1. **Create MongoDB Atlas account** at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
   - Sign up for free (no credit card required)
   - Create a new cluster (select free tier M0)
   - Wait for cluster to be created (2-3 minutes)

2. **Configure database access**
   - Go to "Database Access" → "Add New Database User"
   - Username: create a username
   - Password: create a strong password
   - Click "Create User"

3. **Configure network access**
   - Go to "Network Access" → "Add IP Address"
   - Select "Allow Access from Anywhere" (0.0.0.0/0)
   - Click "Confirm"

4. **Get connection string**
   - Go to "Database" → Click "Connect" → "Connect your application"
   - Select Node.js version
   - Copy the connection string (looks like: `mongodb+srv://username:password@cluster.mongodb.net/tally`)

### Step 2: Deploy on Render (Free)

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
   - Instance type: Free

4. **Add MongoDB connection string**
   - In your web service settings → "Environment"
   - Add variable: `MONGODB_URI` = your MongoDB Atlas connection string
   - Replace `<password>` with your actual password

5. **Deploy**
   - Render will auto-deploy
   - Your app will be live at `https://your-app-name.onrender.com`

### Step 3: Deploy on Railway (Alternative)

1. **Create a GitHub repository** (same as above)

2. **Sign up for Railway** at [railway.app](https://railway.app)

3. **Deploy from GitHub**
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Railway will auto-detect Node.js
   - Click "Deploy"

4. **Add MongoDB connection string**
   - Go to your project → "Variables"
   - Add variable: `MONGODB_URI` = your MongoDB Atlas connection string

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
- `MONGODB_URI`: MongoDB connection string (required for deployment)

## Important Notes

- **MongoDB Atlas**: Free tier provides 512MB storage - sufficient for this app
- **Data persistence**: MongoDB Atlas ensures data persists across deployments
- **Security**: This is a simple app without authentication - add auth if needed for production
- **MongoDB connection**: Keep your connection string secure - never commit it to git