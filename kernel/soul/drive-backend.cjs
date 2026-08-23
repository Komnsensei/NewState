'use strict';
/**
 * Google Drive backend for Soul Runtime.
 * Target: passioncraftai@gmail.com folder shared with GCP service account.
 */
const { google } = require('googleapis');
const { Readable } = require('stream');

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const ACCOUNT = process.env.SOUL_DRIVE_ACCOUNT || process.env.OPENKRAFT_ACCOUNT || 'passioncraftai@gmail.com';

function rootFolderId() {
  return process.env.SOUL_DRIVE_FOLDER || process.env.ESMA_DRIVE_FOLDER || process.env.DRIVE_FOLDER_ID || null;
}

function getAuth() {
  const scopes = ['https://www.googleapis.com/auth/drive'];
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    return new google.auth.GoogleAuth({ credentials, scopes });
  }
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyFile) {
    throw new Error('soul/drive-backend: set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_JSON');
  }
  return new google.auth.GoogleAuth({ keyFile, scopes });
}

function getDrive() {
  return google.drive({ version: 'v3', auth: getAuth() });
}

async function findChild(drive, parentId, name) {
  const q = `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`;
  const res = await drive.files.list({
    q,
    fields: 'files(id,name,mimeType)',
    spaces: 'drive',
    pageSize: 10,
  });
  return (res.data.files && res.data.files[0]) || null;
}

async function ensureFolder(drive, parentId, name) {
  const existing = await findChild(drive, parentId, name);
  if (existing) return existing.id;
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: FOLDER_MIME,
      parents: [parentId],
      description: `NewState soul folder \u00b7 account ${ACCOUNT}`,
    },
    fields: 'id,name',
  });
  return res.data.id;
}

async function ensureSoulTree(soulId) {
  const root = rootFolderId();
  if (!root) throw new Error('soul/drive-backend: ESMA_DRIVE_FOLDER or SOUL_DRIVE_FOLDER required');
  const drive = getDrive();
  const agentsId = await ensureFolder(drive, root, 'agents');
  const soulRoot = await ensureFolder(drive, agentsId, soulId);
  const research = await ensureFolder(drive, soulRoot, 'research');
  const artifacts = await ensureFolder(drive, soulRoot, 'artifacts');
  const ledger = await ensureFolder(drive, soulRoot, 'ledger');
  const stim = await ensureFolder(drive, soulRoot, 'stim');
  return { drive, root, agentsId, soulRoot, research, artifacts, ledger, stim, account: ACCOUNT };
}

async function writeText(parentId, filename, content, mimeType = 'text/plain') {
  const drive = getDrive();
  const existing = await findChild(drive, parentId, filename);
  const body = Readable.from([typeof content === 'string' ? content : JSON.stringify(content, null, 2)]);
  if (existing) {
    const res = await drive.files.update({
      fileId: existing.id,
      media: { mimeType, body },
      fields: 'id,name,modifiedTime,webViewLink',
    });
    return { action: 'updated', file: res.data };
  }
  const res = await drive.files.create({
    requestBody: { name: filename, parents: [parentId], mimeType },
    media: { mimeType, body },
    fields: 'id,name,createdTime,webViewLink',
  });
  return { action: 'created', file: res.data };
}

async function readText(parentId, filename) {
  const drive = getDrive();
  const existing = await findChild(drive, parentId, filename);
  if (!existing) return null;
  const res = await drive.files.get({ fileId: existing.id, alt: 'media' }, { responseType: 'text' });
  return res.data;
}

async function appendText(parentId, filename, line) {
  const prev = (await readText(parentId, filename)) || '';
  return writeText(parentId, filename, prev + line);
}

async function listChildren(parentId) {
  const drive = getDrive();
  const res = await drive.files.list({
    q: `'${parentId}' in parents and trashed=false`,
    fields: 'files(id,name,mimeType,modifiedTime,size,webViewLink)',
    orderBy: 'modifiedTime desc',
    spaces: 'drive',
    pageSize: 100,
  });
  return res.data.files || [];
}

async function syncSoulToDrive(soulId, localSoul, opts = {}) {
  const tree = await ensureSoulTree(soulId);
  const results = [];
  if (localSoul) {
    results.push(await writeText(tree.soulRoot, 'soul.json', JSON.stringify(localSoul, null, 2), 'application/json'));
  }
  if (opts.scc) {
    results.push(await writeText(tree.soulRoot, 'scc-latest.json', JSON.stringify(opts.scc, null, 2), 'application/json'));
  }
  if (opts.autonomy) {
    results.push(await writeText(tree.soulRoot, 'autonomy-state.json', JSON.stringify(opts.autonomy, null, 2), 'application/json'));
  }
  if (opts.biographyLine) {
    const line = opts.biographyLine.endsWith('\n') ? opts.biographyLine : opts.biographyLine + '\n';
    results.push(await appendText(tree.soulRoot, 'biography.jsonl', line));
  }
  if (opts.ledgerLine) {
    const line = opts.ledgerLine.endsWith('\n') ? opts.ledgerLine : opts.ledgerLine + '\n';
    results.push(await appendText(tree.ledger, 'events.jsonl', line));
  }
  if (opts.research) {
    const name = opts.research.name || `research-${Date.now()}.json`;
    results.push(await writeText(tree.research, name, JSON.stringify(opts.research.body, null, 2), 'application/json'));
  }
  if (opts.artifact) {
    const name = opts.artifact.name || `artifact-${Date.now()}.json`;
    results.push(await writeText(tree.artifacts, name, JSON.stringify(opts.artifact.body, null, 2), 'application/json'));
  }
  return {
    ok: true,
    account: ACCOUNT,
    soulId,
    folderId: tree.soulRoot,
    results: results.map((r) => ({ action: r.action, id: r.file.id, name: r.file.name })),
  };
}

async function loadSoulFromDrive(soulId) {
  const tree = await ensureSoulTree(soulId);
  const raw = await readText(tree.soulRoot, 'soul.json');
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

module.exports = {
  ACCOUNT,
  rootFolderId,
  getDrive,
  ensureSoulTree,
  writeText,
  readText,
  appendText,
  listChildren,
  syncSoulToDrive,
  loadSoulFromDrive,
};
