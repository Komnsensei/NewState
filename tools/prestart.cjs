'use strict';
/**
 * Cross-platform prestart. QIH PowerShell integrator is optional.
 * Never fail the process — Railway/Linux must start without pwsh.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ps1 = path.join(__dirname, 'QIH-Integrator.ps1');
if (!fs.existsSync(ps1)) {
  console.log('[prestart] no QIH-Integrator.ps1 — continue');
  process.exit(0);
}

const candidates = ['pwsh', 'powershell'];
for (const bin of candidates) {
  const r = spawnSync(bin, ['-File', ps1], { stdio: 'inherit', shell: false });
  if (r.error && r.error.code === 'ENOENT') continue;
  if (r.status === 0) {
    console.log('[prestart] QIH integrator completed via', bin);
    process.exit(0);
  }
  console.warn('[prestart] QIH integrator exited', r.status, '— continuing startup');
  process.exit(0);
}
console.log('[prestart] PowerShell not available — skip QIH integrator');
process.exit(0);
