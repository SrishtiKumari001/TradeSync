# AWS Deployment Guide (free-tier)

> Full step-by-step walkthrough to deploy **Mini ERP + CRM Operations Portal** on AWS for ~$0/month (free tier, first 12 months).

## Architecture

```
Browser ──HTTPS──► CloudFront (d3eormzf4777t6.cloudfront.net)
                    ├── default /*    ──► S3 bucket (React dist/, SPA routing)
                    └── /api/*, /health ──► EC2 t2.micro :5000 (Docker)
                                              ├── backend (Express + Prisma)
                                              └── postgres:16-alpine (named volume)
```

Why the API goes through CloudFront too: the frontend is served over HTTPS, so a plain
`http://<ec2-ip>:5000` API call would be blocked by browsers as mixed content. Routing
`/api/*` through the same CloudFront distribution keeps everything same-origin HTTPS —
and CORS stops being a concern entirely.

## Cost notes

- `t2.micro` EC2: free (750 h/month) for the first 12 months of a new account.
- S3, CloudFront (1 TB/month), EBS 8 GB: inside free tier.
- After 12 months: roughly `$8/mo` EC2 + a few dollars of storage/transfer.

---

## Phase 0 — Prerequisites (your machine)

1. AWS account (root) + IAM user `admin-cli` with `AdministratorAccess` and **Access Keys**.
2. AWS CLI v2 installed and configured:

   ```powershell
   aws configure        # Access Key ID, Secret, region (e.g. ap-south-1), json
   aws sts get-caller-identity   # → shows Account / Arn — success means it works
   ```

3. Node 18+ locally (to build the frontend).

## Phase 1 — EC2 instance (Postgres + backend)

### 1.1 Launch

1. Console → **EC2 → Launch instance**:
   - Name: `minierp-backend`
   - AMI: **Ubuntu 24.04 LTS** (free tier eligible)
   - Instance type: **t2.micro**
   - Key pair: **Create new** → `minierp-key` → download the `.pem`
   - Storage: 8 GB gp3 (default is fine)
   - **Security group**: create with
     - SSH (22) from `YourIP/32`
     - Custom TCP (5000) from `0.0.0.0/0` (CloudFront will fetch the API from here)
   - Launch, then copy the **Public IPv4 address** (e.g. `13.234.118.208`).

### 1.2 Connect (from PowerShell)

```powershell
ssh -i .\minierp-key.pem ubuntu@13.234.118.208
```

> If Windows complains about the key permissions, right-click the `.pem` → Properties →
> Security → Advanced → remove inherited permissions, add **your user** with Full control.

### 1.3 Install Docker + swap

```bash
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER && newgrp docker
docker --version
```

t2.micro has only 1 GB RAM — the backend's TypeScript build can OOM. Add 2 GB swap:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

### 1.4 Secrets

Create `/home/ubuntu/minierp/.env` (inside the project directory you'll clone to):

```bash
mkdir -p ~/minierp && cd ~/minierp
openssl rand -base64 48        # → use output as JWT_SECRET
openssl rand -base64 24        # → use output as DB_PASSWORD
cat > .env <<'EOF'
DB_USER=minierp
DB_NAME=minierp
DB_PASSWORD=<strong db password>
JWT_SECRET=<strong jwt secret, 48+ chars>
JWT_EXPIRES_IN=1d
CORS_ORIGIN=*
EOF
```

### 1.5 Ship the code

From your machine (git repo must be committed/pushed, or copy files over):

```bash
# Option A — git
git clone <your-repo-url> ~/minierp/app

# Option B — scp the repo folder (Windows PowerShell)
scp -r "C:\Users\asus\Documents\Projects_2021_2026\Mini ERP + CRM Operations Portal" ubuntu@13.234.118.208:~/minierp/app
```

### 1.6 Build & start

```bash
cd ~/minierp/app
docker compose --env-file ~/minierp/.env -f docker-compose.prod.yml up -d --build
docker compose --env-file ~/minierp/.env -f docker-compose.prod.yml ps   # both healthy
```

> The `.env` with secrets lives at `~/minierp/.env` (outside the repo). `docker compose`
> needs `--env-file` to read it — the compose file itself never contains secrets.

### 1.7 Apply migrations + seed demo data (one time)

```bash
docker compose --env-file ~/minierp/.env -f docker-compose.prod.yml exec backend npx prisma migrate deploy
docker compose --env-file ~/minierp/.env -f docker-compose.prod.yml exec backend npx tsx prisma/seed.ts
```

### 1.8 Verify

```bash
curl http://13.234.118.208:5000/health
# {"success":true,"message":"Mini ERP + CRM API is running",...}
```

---

## Phase 2 — Frontend on S3 + CloudFront

### 2.1 S3 bucket

1. Console → **S3 → Create bucket**:
   - Name: `minierp-portal-frontend` (must be globally unique)
   - Region: **same as EC2**
   - **Block all public access** ON (default)
2. Keep empty for now.

### 2.2 CloudFront distribution (create FIRST — you need its domain)

Console → **CloudFront → Create distribution**:

- **Origin 1** (default): S3 bucket `minierp-portal-frontend`
  - Origin access: **Origin access control settings (recommended)** → Create control setting (new)
  - ✅ *"I understand and acknowledge…"* → the console offers to attach the bucket policy — accept it.
- **Origin 2**: `http://13.234.118.208:5000` (EC2) — protocol HTTP only, port 5000. Use the EC2 **public DNS name** (e.g. `ec2-13-234-118-208.ap-south-1.compute.amazonaws.com:5000`) rather than a bare IP — CloudFront rejects raw IPs as custom-origin domains.
- **Behaviors** (add two before finishing):
  - Path pattern `/api/*` → Origin 2 (EC2), Cache policy **CachingDisabled**, Origin request policy **AllViewer**, Viewer protocol **HTTPS only**.
  - Path pattern `/health` → same as above.
  - Default behavior `*` → Origin 1 (S3), Cache policy **CachingOptimized**.
- **Settings**:
  - Price class: `Use only North America and Europe` (cheaper; adjust if users are elsewhere)
  - Default root object: `index.html`
  - **Error responses → Create response**:
    - 403 → 200, Response page path `/index.html`
    - 404 → 200, Response page path `/index.html`
      (SPA fallback so `/customers` etc. work on direct load/refresh)
- Create → copy the **Distribution domain name**: `d3eormzf4777t6.cloudfront.net`.

> ⚠️ **Creating the distribution via CLI/API instead of the console:** an S3 origin
> **must include `S3OriginConfig: { "OriginAccessIdentity": "" }`** in the origin item
> (yes, even when you're using OAC) or CloudFront rejects it with `InvalidOrigin`.
> Also use the exact managed policy IDs from `list-cache-policies --type managed`
> (`Managed-CachingDisabled` = `4135ea2d-6df8-44a3-9df3-4b5a84be39ad`,
> `Managed-CachingOptimized` = `658327ea-f89d-4fab-a63d-7e88639e58f6`,
> `Managed-AllViewer` origin-request-policy = `216adef6-5c7f-47e4-b989-5492eafa07d3`).

### 2.3 Build the frontend

From `frontend/` on your machine, PowerShell:

```powershell
cd frontend
$env:VITE_API_URL = "https://d3eormzf4777t6.cloudfront.net"
npm install
npm run build
```

### 2.4 Upload

```powershell
aws s3 sync frontend/dist/ s3://minierp-portal-frontend --delete
```

---

## Phase 3 — End-to-end verification

1. Open `https://d3eormzf4777t6.cloudfront.net` → login page.
2. Log in with seeded credentials, e.g. `admin@minierp.com` / `Admin@123`.
3. Critical stock flows:
   - Create a challan → confirm (stock drops) → cancel (stock restored).
   - Try a manual OUT bigger than current stock → expect `409` message.
4. SPA deep link: open `https://d3eormzf4777t6.cloudfront.net/customers` directly → must render, not 404.

---

## Phase 4 — Operations

### Redeploy backend

```bash
cd ~/minierp/app && git pull
docker compose --env-file ~/minierp/.env -f docker-compose.prod.yml up -d --build
docker compose --env-file ~/minierp/.env -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

### Redeploy frontend

```powershell
cd frontend
$env:VITE_API_URL = "https://d3eormzf4777t6.cloudfront.net"
npm run build
aws s3 sync frontend/dist/ s3://minierp-portal-frontend --delete
aws cloudfront create-invalidation --distribution-id EXXXXXX --paths "/*"
```

### Backups

```bash
# DB dump (run on EC2)
docker compose --env-file ~/minierp/.env -f docker-compose.prod.yml exec db pg_dump -U minierp minierp > backup_$(date +%F).sql

# EC2 volume snapshot: Console → EC2 → Volumes → Actions → Create snapshot (weekly)
```

### Logs

```bash
docker compose --env-file ~/minierp/.env -f docker-compose.prod.yml logs -f backend
```

### Security reminders

- Keep port 22 SSH locked to your IP only.
- Rotate `JWT_SECRET` and `DB_PASSWORD` periodically (restart containers after).
- `.env` lives only on the server — never commit it (`.gitignore` already covers it).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `curl :5000/health` fails | `docker compose ps` — is `db` healthy? `docker compose logs backend` |
| CloudFront → EC2 timeout | Security group must allow TCP 5000 from `0.0.0.0/0`; API behavior must use port `:5000` origin |
| SPA 404 on refresh | Error responses 403/404 → `/index.html` not configured |
| Login works, API 401/CORS | Same-origin via CloudFront should avoid CORS entirely; check `CORS_ORIGIN=*` and `VITE_API_URL` was the CloudFront URL at build time |
| OOM during `docker build` | Swap not enabled — check `free -h` (see 1.3) |
