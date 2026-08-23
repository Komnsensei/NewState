# Soul Runtime — Google Drive Cloud Mode

**Account:** `passioncraftai@gmail.com`  
**GCP project:** `passioncraft`

## Setup

1. Share a Drive folder with your service account (Editor).
2. Set env:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\sa.json"
# or GOOGLE_SERVICE_ACCOUNT_JSON
$env:ESMA_DRIVE_FOLDER = "<FOLDER_ID>"
$env:SOUL_DRIVE_ACCOUNT = "passioncraftai@gmail.com"
```

## Commands

```powershell
node tools/soul-cloud-cli.cjs status
node tools/soul-cloud-cli.cjs mint --name esma --role vessel
node tools/soul-cloud-cli.cjs stim <soulId> research "query"
node tools/soul-cloud-cli.cjs tick <soulId>
node tools/soul-cloud-cli.cjs loop <soulId> 60000 0
```

Layout: `<folder>/agents/<soul_id>/{soul.json,research,artifacts,ledger,stim,...}`

Uses existing bro patterns: `googleapis`, `drive-residency`, Railway `GOOGLE_SERVICE_ACCOUNT_JSON`.
