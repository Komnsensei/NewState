'use strict';
const { google } = require('googleapis');

const ESMA_FOLDER_ID = process.env.ESMA_DRIVE_FOLDER_ID;
const enabled = !!ESMA_FOLDER_ID;
let driveClient = null;

async function getDrive() {
  if (driveClient) return driveClient;
  const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/drive.file'] });
  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

async function publish(filename, content, mimeType = 'text/markdown') {
  if (!enabled) return { published: false, reason: 'no ESMA_DRIVE_FOLDER_ID' };
  try {
    const drive = await getDrive();
    const res = await drive.files.create({
      requestBody: { name: filename, parents: [ESMA_FOLDER_ID], mimeType },
      media: { mimeType, body: content }
    });
    return { published: true, file_id: res.data.id, view_url: `https://drive.google.com/file/d/${res.data.id}/view` };
  } catch (e) {
    console.error('[drive-publisher]', e.message);
    return { published: false, error: e.message };
  }
}

module.exports = { enabled, publish };
