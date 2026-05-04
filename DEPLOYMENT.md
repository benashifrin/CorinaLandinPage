# Atanase Smiles Landing Page - AWS Deployment Guide

## Architecture
- **Frontend**: AWS Amplify (static HTML) → `atanasesmiles.dentivolve.com`
- **Backend**: AWS App Runner (Node.js API) → writes to Google Sheets

---

## Step 1: Deploy Backend to AWS App Runner

### 1.1 Push Backend to GitHub (or use ECR)

Create a new GitHub repo for the backend or use the same repo with the `/backend` folder.

### 1.2 Create App Runner Service

1. Go to **AWS Console** → **App Runner**
2. Click **Create service**
3. Choose **Source code repository**
4. Connect to your GitHub repo and select the `/backend` folder
5. Configure build settings:
   - Runtime: **Node.js 18**
   - Build command: `npm install`
   - Start command: `npm start`
   - Port: `8080`

### 1.3 Set Environment Variables

In App Runner service configuration, add these environment variables:

| Variable | Value |
|----------|-------|
| `SPREADSHEET_ID` | `1xM1IL9IYs_SOag3p4-DFoSwW4h1lqe2iK0ywaByosKA` |
| `GOOGLE_CREDENTIALS` | *(paste entire JSON from service account file - see below)* |

**For GOOGLE_CREDENTIALS**: Copy the entire contents of `send-emails-481116-5eba4d0e330b.json` and paste it as the value. Make sure it's a single line (minified JSON).

To minify the JSON:
```bash
cat send-emails-481116-5eba4d0e330b.json | jq -c .
```

### 1.4 Note Your App Runner URL

After deployment, you'll get a URL like:
```
https://xxxxxxxx.us-east-1.awsapprunner.com
```

---

## Step 2: Update Frontend with API URL

Edit `index.html` (or `dental-landing-page.html`) and replace the placeholder:

```javascript
const API_URL = 'https://YOUR-APP-RUNNER-URL.us-east-1.awsapprunner.com';
```

With your actual App Runner URL:
```javascript
const API_URL = 'https://xxxxxxxx.us-east-1.awsapprunner.com';
```

---

## Step 3: Deploy Frontend to AWS Amplify

### 3.1 Create Amplify App

1. Go to **AWS Console** → **AWS Amplify**
2. Click **New app** → **Host web app**
3. Choose **GitHub** and connect your repo
4. Select the branch to deploy
5. Configure build settings (use the `amplify.yml` in the repo)

### 3.2 Configure Custom Domain

1. In your Amplify app, go to **Domain management**
2. Click **Add domain**
3. Enter: `dentivolve.com`
4. Add subdomain: `atanasesmiles`
5. Amplify will provide DNS records (CNAME)

### 3.3 Update DNS (in your domain registrar)

Add a CNAME record:
- **Host**: `atanasesmiles`
- **Value**: *(provided by Amplify, e.g., `xxxxxx.cloudfront.net`)*

---

## Step 4: Configure Google Sheet

Make sure the Google Sheet has headers in Row 1:

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| Timestamp | First Name | Last Name | Phone | Email | CPAP Status | Sleep Study | Severity | Insurance |

Also ensure the service account (`atanasesmiles@send-emails-481116.iam.gserviceaccount.com`) has **Editor** access to the sheet.

---

## Testing

1. Test the backend health check:
   ```bash
   curl https://YOUR-APP-RUNNER-URL/health
   ```

2. Test form submission:
   ```bash
   curl -X POST https://YOUR-APP-RUNNER-URL/api/submit \
     -H "Content-Type: application/json" \
     -d '{"firstName":"Test","phone":"555-1234","cpapStatus":"Test"}'
   ```

3. Check Google Sheet for the new row

---

## File Structure

```
CorinaLandinPage/
├── index.html                 # Landing page (copy of dental-landing-page.html)
├── dental-landing-page.html   # Original landing page
├── amplify.yml               # Amplify build config
├── send-emails-481116-*.json # Google service account (DO NOT commit to public repo)
└── backend/
    ├── server.js             # Express API
    ├── package.json          # Dependencies
    ├── Dockerfile            # For container deployments
    └── apprunner.yaml        # App Runner config
```
