'use strict';
require('dotenv').config();
const { forensics } = require('./kernel/forensics.cjs');

const errs = forensics.query({ type: 'PROMPT_DRIFT' });
console.log('PROMPT_DRIFT events:', errs.length);
console.log(JSON.stringify(errs, null, 2));

const all = forensics.query({});
console.log('ALL forensics events:', all.length);
if (all.length) console.log(JSON.stringify(all.slice(-5), null, 2));
