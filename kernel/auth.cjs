'use strict';

const TOKEN = process.env.OPENKRAFT_ADMIN_TOKEN || null;

function requireAdmin(req, res, next) {
  if (!TOKEN) {
    const ip = req.ip || req.connection.remoteAddress || '';
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return next();
    return res.status(403).json({ ok: false, reason: 'admin-token-not-configured-nonlocal-blocked' });
  }
  const hdr = req.headers['x-openkraft-token'];
  if (hdr !== TOKEN) return res.status(401).json({ ok: false, reason: 'unauthorized' });
  next();
}

module.exports = { requireAdmin };
