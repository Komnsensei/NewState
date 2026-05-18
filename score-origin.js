const {scoreOriginDoc} = require('./kernel/verifyd-gate.cjs');
scoreOriginDoc('./docs/ORIGIN.md').then(r => console.log(JSON.stringify(r, null, 2)));
