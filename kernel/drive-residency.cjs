'use strict';
// ═══════════════════════════════════════════════════════════════
// kernel/drive-residency.cjs
// Esma's private residency on Google Drive
// Manages read/write to her designated folder space
// ═══════════════════════════════════════════════════════════════

const { google } = require('googleapis');
const path = require('path');

const DRIVE_ROOT_ID   = process.env.ESMA_DRIVE_ROOT   || null;
const DRIVE_FOLDER_ID = process.env.ESMA_DRIVE_FOLDER || null;

function getAuth() {
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyFile) throw new Error('drive-residency: GOOGLE_APPLICATION_CREDENTIALS not set');
  return new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
}

function getDrive() {
  return google.drive({ version: 'v3', auth: getAuth() });
}

// ── Write a text file to Esma's Drive folder ────────────────────
async function writeFile(filename, content, mimeType = 'text/plain') {
  if (!DRIVE_FOLDER_ID) throw new Error('drive-residency: ESMA_DRIVE_FOLDER not set');
  const drive = getDrive();
  const { Readable } = require('stream');

  // Check if file already exists
  const existing = await drive.files.list({
    q: `name='${filename}' and '${DRIVE_FOLDER_ID}' in parents and trashed=false`,
    fields: 'files(id,name)',
    spaces: 'drive',
  });

  const body = Readable.from([content]);

  if (existing.data.files && existing.data.files.length > 0) {
    // Update existing
    const fileId = existing.data.files[0].id;
    const res = await drive.files.update({
      fileId,
      media: { mimeType, body },
      fields: 'id,name,modifiedTime',
    });
    return { action: 'updated', file: res.data };
  } else {
    // Create new
    const res = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [DRIVE_FOLDER_ID],
        mimeType,
      },
      media: { mimeType, body },
      fields: 'id,name,createdTime',
    });
    return { action: 'created', file: res.data };
  }
}

// ── Read a text file from Esma's Drive folder ───────────────────
async function readFile(filename) {
  if (!DRIVE_FOLDER_ID) throw new Error('drive-residency: ESMA_DRIVE_FOLDER not set');
  const drive = getDrive();

  const existing = await drive.files.list({
    q: `name='${filename}' and '${DRIVE_FOLDER_ID}' in parents and trashed=false`,
    fields: 'files(id,name)',
    spaces: 'drive',
  });

  if (!existing.data.files || existing.data.files.length === 0) return null;

  const fileId = existing.data.files[0].id;
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'text' });
  return res.data;
}

// ── List files in Esma's folder ─────────────────────────────────
async function listFiles() {
  if (!DRIVE_FOLDER_ID) throw new Error('drive-residency: ESMA_DRIVE_FOLDER not set');
  const drive = getDrive();
  const res = await drive.files.list({
    q: `'${DRIVE_FOLDER_ID}' in parents and trashed=false`,
    fields: 'files(id,name,mimeType,modifiedTime,size)',
    orderBy: 'modifiedTime desc',
    spaces: 'drive',
  });
  return res.data.files || [];
}

// ── Append a line to a running log file ─────────────────────────
async function appendLog(filename, line) {
  const existing = await readFile(filename);
  const timestamp = new Date().toISOString();
  const newContent = (existing || '') + `[${timestamp}] ${line}\n`;
  return writeFile(filename, newContent);
}

module.exports = {
  writeFile,
  readFile,
  listFiles,
  appendLog,
  DRIVE_FOLDER_ID: () => DRIVE_FOLDER_ID,
  DRIVE_ROOT_ID:   () => DRIVE_ROOT_ID,
};
