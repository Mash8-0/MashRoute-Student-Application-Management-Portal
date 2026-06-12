# Deploying MashRoute to Hostinger

MashRoute is **not a static website** — it has three parts:

- **Frontend** — React/Vite → builds to static files (`frontend/dist`)
- **Backend** — Node/Express + Socket.io + Prisma → needs a persistent Node.js runtime
- **Database** — Neon PostgreSQL (already cloud-hosted; nothing to install)

Because the backend needs an always-on Node process with websockets, **how you deploy depends on your Hostinger plan.**

---

## 0. First: identify your Hostinger plan

Log in to **hPanel** (hpanel.hostinger.com) and look at the left sidebar / top tabs:

- If you see a **"VPS"** section (with an IP address and "Browser terminal" / SSH) → you have a **VPS**. ✅ Use **Path A** — host everything in one place.
- If you only see **"Websites" / "Hosting"** (Premium / Business / Cloud, file manager, no SSH root) → you have **shared/cloud hosting**. Use **Path B**.

> **Recommendation:** MashRoute runs best on a **VPS** (Path A) because it needs a long-running Node process and Socket.io websockets. Hostinger's cheapest **KVM 1 VPS** is enough. If you only have shared hosting, Path B puts the frontend on Hostinger and the backend on a free Node host.

---

## Path A — Hostinger VPS (recommended, hosts the whole app)

You'll run: **Nginx** (web server + reverse proxy) + **PM2** (keeps Node alive) + the **static frontend**.

### A1. Point your domain at the VPS
In hPanel → **VPS → your domain's DNS**, create an `A` record for `@` and `www` pointing to the VPS IP.

### A2. Connect & install prerequisites
SSH in (hPanel shows the command, or use the browser terminal):
```bash
ssh root@YOUR_VPS_IP

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs nginx git
npm install -g pm2
```

### A3. Get the code onto the server
Either `git clone` your repo, or upload the project with SFTP to `/var/www/mashroute`.
```bash
mkdir -p /var/www/mashroute && cd /var/www/mashroute
# git clone <your-repo-url> .   (or upload via SFTP)
```

### A4. Configure the backend
```bash
cd /var/www/mashroute/backend
cp .env.production.example .env
nano .env        # fill in DATABASE_URL (Neon), JWT secrets, ALLOWED_ORIGINS=https://yourdomain.com,
                 # PUBLIC_API_URL=https://yourdomain.com, Google Drive vars (optional)

npm ci --omit=dev
npx prisma generate
npx prisma db push          # creates/syncs tables on Neon
node prisma/seed.js         # OPTIONAL: seeds the super admin (uses SUPER_ADMIN_* from .env)
```

### A5. Build the frontend
```bash
cd /var/www/mashroute/frontend
cp .env.production.example .env.production
nano .env.production        # VITE_API_URL=https://yourdomain.com/api/v1
                            # VITE_SOCKET_URL=https://yourdomain.com
npm ci
npm run build               # outputs to frontend/dist
```

### A6. Start the backend with PM2
```bash
cd /var/www/mashroute
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup        # run the command it prints, so the API restarts on reboot
```

### A7. Configure Nginx
```bash
cp /var/www/mashroute/deploy/nginx-mashroute.conf /etc/nginx/sites-available/mashroute
nano /etc/nginx/sites-available/mashroute     # replace yourdomain.com
ln -s /etc/nginx/sites-available/mashroute /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```
Your site is now live on `http://yourdomain.com`.

### A8. Enable HTTPS (free SSL)
```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```
Certbot rewrites the Nginx config for HTTPS and auto-renews. Done — `https://yourdomain.com` 🎉

---

## Path B — Shared / Cloud hosting (frontend on Hostinger, backend elsewhere)

Shared hosting can serve the **static frontend** perfectly, but a persistent Node API
with websockets is unreliable there. Host the backend on a free/cheap Node host
(**Render** — there's already a `render.yaml` in `backend/`, or Railway), then point
the frontend at it.

### B1. Deploy the backend (Render example)
1. Push the repo to GitHub.
2. Render → **New → Web Service** → pick the repo → root dir `backend`.
3. Build command: `npm ci && npx prisma generate && npx prisma db push`
   Start command: `node src/server.js`
4. Add env vars from `backend/.env.production.example` (DATABASE_URL, JWT secrets,
   `ALLOWED_ORIGINS=https://yourdomain.com`, `PUBLIC_API_URL=https://your-api.onrender.com`, etc.).
5. Deploy → note the API URL, e.g. `https://mashroute-api.onrender.com`.

### B2. Build the frontend pointing at that API
On your machine:
```bash
cd frontend
cp .env.production.example .env.production
# VITE_API_URL=https://mashroute-api.onrender.com/api/v1
# VITE_SOCKET_URL=https://mashroute-api.onrender.com
npm run build
```

### B3. Upload the frontend to Hostinger
- hPanel → **File Manager** → open `public_html`.
- Upload **the contents of `frontend/dist`** (not the folder itself) into `public_html`.
- Add a `.htaccess` in `public_html` so React Router deep links work:
  ```apache
  <IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
  </IfModule>
  ```
- Make sure the backend's `ALLOWED_ORIGINS` includes your Hostinger domain.

> If you have a Business/Cloud plan with the **"Node.js App"** feature in hPanel you *can* try running the backend there (set startup file `src/server.js`, run `npm install` + `npx prisma db push`), but Socket.io websockets often don't work on shared hosting — the live notifications may degrade. Render is the more reliable choice.

---

## Important notes

- **Secrets:** never commit the real `.env`. The `.env.production.example` files are templates only.
- **Database:** Neon is already cloud-hosted — just reuse your `DATABASE_URL`. `npx prisma db push` syncs the schema; it does **not** wipe data.
- **Google Drive:** your current refresh token is expired (`invalid_grant`), so uploads fall back to **local storage** under `/uploads`. On a VPS that's persistent and works. To restore Drive, re-authorize and set the `GOOGLE_*` vars. Set `PUBLIC_API_URL` so local file links are absolute.
- **CORS:** `ALLOWED_ORIGINS` must list your exact frontend origin(s), comma-separated, with `https://`.
- **Updating later:** `git pull` → backend `npm ci && npx prisma db push && pm2 restart mashroute-api` → frontend `npm run build`.
