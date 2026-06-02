# Railway Deployment Guide

## Prerequisites

- [Railway account](https://railway.app)
- Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
- Telegram bot token from [@BotFather](https://t.me/BotFather)

## Step-by-Step Deployment

### 1. Create Railway Project

```bash
# Clone your repo (if not already done)
git clone https://github.com/Komnsensei/NewState.git
cd NewState

# Initialize Railway (if first time)
railway init
```

### 2. Set Environment Variables on Railway

In Railway dashboard, go to **Variables** and add:

```
GEMINI_API_KEY=your-actual-gemini-api-key
TELEGRAM_BOT_TOKEN=your-actual-telegram-bot-token
```

**Do NOT commit these to Git** — Railway will populate them at runtime.

### 3. Determine Your Railway Domain

After deploying (see step 4), Railway assigns you a domain. Find it in the **Deploy** tab:

```
https://newstate-production-xxxx.up.railway.app
```

Copy this full URL (including https://).

### 4. Deploy to Railway

```bash
# Push to GitHub (Railway auto-deploys on push)
git add .
git commit -m "deploy: Railway setup"
git push origin main

# OR manually deploy via Railway CLI
railway up
```

Watch the deployment logs. Deployment is complete when you see:
```
[NEWSTATE] listening on :PORT
```

### 5. Configure Telegram Webhook

Once Railway domain is known, set the webhook URL:

```bash
# Run this locally (requires your bot token):
curl -X POST \
  https://api.telegram.org/bot{YOUR_TELEGRAM_TOKEN}/setWebhook \
  -H "Content-Type: application/json" \
  -d '{"url":"https://newstate-production-xxxx.up.railway.app/telegram/webhook"}'
```

Expected response:
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

### 6. Test the Bot

Message your Telegram bot. It should respond with a message from Esma.

## Troubleshooting

### "Webhook returns 400" Error

**Symptoms:** Bot posts message, Telegram shows "kernel error" or "400 Bad Request"

**Solutions (in order):**

1. **Check logs on Railway:**
   ```bash
   railway logs
   ```
   Look for `[NEWSTATE-ERROR]` messages.

2. **Verify WEBHOOK_BASE_URL is set correctly:**
   - Must be the exact Railway domain
   - Must be HTTPS (not HTTP)
   - Must not include trailing slash
   - Example: `https://newstate-production-xxxx.up.railway.app` ✓

3. **Re-register the webhook:**
   ```bash
   curl -X POST \
     https://api.telegram.org/bot{TOKEN}/setWebhook \
     -H "Content-Type: application/json" \
     -d '{"url":"https://newstate-production-xxxx.up.railway.app/telegram/webhook"}'
   ```

4. **Check memory/CPU limits:**
   - Go to Railway **Settings** → increase memory if needed
   - JSON parsing failures can happen under memory pressure

5. **Test directly (without Telegram):**
   ```bash
   curl -X POST \
     https://newstate-production-xxxx.up.railway.app/chat \
     -H "Content-Type: application/json" \
     -d '{"message":"Hello, Esma"}'
   ```
   If this works, the issue is Telegram webhook format.

### "getMe failed" or Bot Disabled

**Problem:** Server starts but bot reports "token present but getMe failed"

**Solutions:**

1. Verify token in Railway variables (copy-paste from @BotFather)
2. Check Railway has internet access (it does by default)
3. Try requesting a new token from @BotFather

### "Kernel error" in Telegram

**Problem:** Bot sends back `[Error: kernel-error]` messages

**Solutions:**

1. Check `GEMINI_API_KEY` is valid and has quota
2. Review Railway logs: `railway logs` for model invocation errors
3. Try the `/status` endpoint to check runtime state:
   ```bash
   curl https://newstate-production-xxxx.up.railway.app/status
   ```

### "ETIMEDOUT" or Slow Responses

**Problem:** Telegram shows "bot didn't respond" or takes >30 seconds

**Solutions:**

1. Check Railway region is close to you (Settings → Region)
2. Increase `GEMINI_TIMEOUT_MS`:
   ```
   GEMINI_TIMEOUT_MS=45000
   ```
3. Reduce model complexity if using `gemini-1.5-pro` (try `gemini-1.5-flash`)

## Performance Tuning

### Memory

Default Railway memory is usually sufficient. Adjust in **Settings**:
- Minimum: 512MB
- Recommended: 1GB+

### Concurrency

If bot gets slammed with messages:
- Set `GEMINI_MAX_RETRIES=1` to fail faster
- Reduce `GEMINI_TIMEOUT_MS` to 15000

### Logging Level

For production (reduce noise):
```
NODE_ENV=production
```

For debugging:
```
NODE_ENV=development
```

## Monitoring

### Health Check

Railway automatically runs `/health` every 30 seconds. Verify it's working:

```bash
curl https://newstate-production-xxxx.up.railway.app/health
```

Response:
```json
{"status":"ok","uptime":12345.67,"timestamp":"2026-06-02T...","environment":"production"}
```

### View Logs

```bash
# Live logs
railway logs -f

# Last 100 lines
railway logs | tail -100

# Grep for errors
railway logs | grep ERROR
```

### Restart Service

```bash
railway restart
```

## Security Notes

- **Never commit .env files** to Git
- **Rotate tokens regularly** via @BotFather if compromised
- **Use Railway's Variable feature** to manage secrets
- **Keep Gemini API key private** — treat as password

## Webhook Health Check

Set up a scheduled check (e.g., every hour) to verify webhook is registered:

```bash
curl -s https://api.telegram.org/bot{TOKEN}/getWebhookInfo | jq
```

Expected output:
```json
{
  "ok": true,
  "result": {
    "url": "https://newstate-production-xxxx.up.railway.app/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "ip_address": "...",
    "last_error_date": null,
    "last_error_message": ""
  }
}
```

If `has_custom_certificate` is true or there are errors, re-run setWebhook.

## Need Help?

- Check Railway status: https://status.railway.app
- Review Railway docs: https://docs.railway.app
- Telegram Bot API docs: https://core.telegram.org/bots/api
