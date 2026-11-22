// Run from the project root:  node add-aspirin-rule.mjs
// Adds the label dose limit for aspirin (OTC pain reliever: max 12 x 325 mg = 3900 mg per 24 h, age 12+).
// Needs apply-dose-rules.mjs to have been run first. Makes a backup and changes nothing if the expected code is not found.
import fs from 'node:fs';

const file = 'backend/src/safety.js';
if (!fs.existsSync(file)) { console.error('Run this from the project root (the folder that contains backend/).'); process.exit(1); }
let src = fs.readFileSync(file, 'utf8');

if (src.includes('aspirin:{max:3900')) { console.log('Already applied. Nothing to do.'); process.exit(0); }

const from = "warfarin:{max:10,minAge:18,typical:true,source:'https://medlibrary.org/lib/rx/meds/warfarin-sodium-42/'}};";
if (src.split(from).length !== 2) {
  console.error('Could not find the warfarin rule, so NOTHING was changed.\nRun "node apply-dose-rules.mjs" first, then try this again.');
  process.exit(1);
}
const to = from.slice(0, -2) + ",aspirin:{max:3900,minAge:12,source:'https://otclabels.com/lib/otc/otc-meds/aspirin-325mg-1/'}};";
fs.writeFileSync(file + '.bak2', src);
fs.writeFileSync(file, src.replace(from, () => to));
console.log('Done. Backup saved as backend/src/safety.js.bak2');
