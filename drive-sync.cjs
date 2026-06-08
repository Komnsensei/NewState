// drive-sync.cjs — Railway Drive sync worker
// Reads NewState files from Google Drive → writes to AgentState via Passioncraft API

const { google } = require('googleapis');

const FOLDER_ID = '1U_vyVrJ7-CUFtzLKLmFATfLQewCA6D63';
const SKIP_NAMES = new Set(['__pycache__', 'node_modules', '.git']);
const ALLOWED_EXT = new Set(['.cjs', '.js', '.mjs', '.md', '.json', '.txt', '.env.example']);
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set');
  const creds = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/drive.readonly']
  });
}

async function listFiles(drive, parentId, pathPrefix = '') {
  const result = [];
  let pageToken = null;
  do {
    const resp = await drive.files.list({
      q: `'${parentId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id,name,mimeType)',
      pageSize: 100,
      pageToken: pageToken || undefined
    });
    for (const f of resp.data.files) {
      if (SKIP_NAMES.has(f.name)) continue;
      const fullPath = pathPrefix ? `${pathPrefix}/${f.name}` : f.name;
      if (f.mimeType === 'application/vnd.google-apps.folder') {
        const sub = await listFiles(drive, f.id, fullPath);
        result.push(...sub);
      } else {
        const ext = f.name.includes('.') ? '.' + f.name.split('.').pop() : '';
        if (ALLOWED_EXT.has(ext)) result.push({ id: f.id, name: f.name, path: fullPath });
      }
    }
    pageToken = resp.data.nextPageToken;
  } while (pageToken);
  return result;
}

async function readFile(drive, fileId) {
  const resp = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'text' });
  return resp.data;
}

async function syncToBridge(path, content) {
  // Write to local AgentState file log for now — Railway will expose via /drive-state endpoint
  console.log(`[sync] ${path} (${content.length} chars)`);
}

async function runSync() {
  console.log(`[drive-sync] ${new Date().toISOString()} — starting sync`);
  try {
    const auth = getAuth();
    const drive = google.drive({ version: 'v3', auth });
    const files = await listFiles(drive, FOLDER_ID);
    console.log(`[drive-sync] found ${files.length} files`);
    for (const f of files) {
      try {
        const content = await readFile(drive, f.id);
        await syncToBridge(f.path, content);
      } catch(e) {
        console.error(`[drive-sync] error reading ${f.path}: ${e.message}`);
      }
    }
    console.log(`[drive-sync] sync complete`);
  } catch(e) {
    console.error(`[drive-sync] fatal: ${e.message}`);
  }
}

runSync();
setInterval(runSync, SYNC_INTERVAL_MS);
