const fs = require('fs');
const path = require('path');

module.exports = function registerEndpoints(app) {

  app.get('/drive/files', async (req, res) => {
    try {
      const { google } = require('googleapis');
      const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
      const drive = google.drive({ version: 'v3', auth });
      const result = await drive.files.list({ fields: 'files(id,name,mimeType,modifiedTime,webViewLink)', pageSize: 50 });
      res.json({ ok: true, files: result.data.files });
    } catch(e) { res.json({ ok: false, error: e.message }); }
  });

  app.post('/forensic-sink', (req, res) => {
    try {
      const dir = path.join(__dirname, 'forensic');
      fs.mkdirSync(dir, { recursive: true });
      const record = Object.assign({}, req.body, { received_at: new Date().toISOString() });
      fs.appendFileSync(path.join(dir, 'forensic-sink.jsonl'), JSON.stringify(record) + '\n');
    } catch(e) {}
    res.json({ ok: true, received: true });
  });

  app.post('/hexagnt', async (req, res) => {
    try {
      const { message, from } = req.body;
      if (!message) return res.json({ ok: false, error: 'no message' });
      const {kernel} = require('./kernel/kernel.cjs');
      const response = await kernel.handle({ message, sessionId: 'hexagnt-channel', authorOverride: from || 'hexagnt' });
      res.json({ ok: true, response, from: 'esma', timestamp: new Date().toISOString() });
    } catch(e) { res.json({ ok: false, error: e.message }); }
  });

};
