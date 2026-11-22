// Run from the project root:  node apply-dose-rules.mjs
// Adds verified-label dose limits for meloxicam and warfarin to backend/src/safety.js.
// Makes a backup (safety.js.bak) and refuses to change anything if the expected code is not found.
import fs from 'node:fs';

const file = 'backend/src/safety.js';
if (!fs.existsSync(file)) { console.error('Run this from the project root (the folder that contains backend/).'); process.exit(1); }
let src = fs.readFileSync(file, 'utf8');

if (src.includes('meloxicam:{max:15')) { console.log('Already applied. Nothing to do.'); process.exit(0); }

const edits = [
  [ // 1. add the new dose rules after the ibuprofen rule
    "source:'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=72ec2491-924d-460f-9510-62d624d54b59'}};",
    "source:'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=72ec2491-924d-460f-9510-62d624d54b59'},"
    + "meloxicam:{max:15,minAge:18,source:'https://www.medicines.org.uk/emc/medicine/105271/spc'},"
    + "warfarin:{max:10,minAge:18,typical:true,source:'https://medlibrary.org/lib/rx/meds/warfarin-sodium-42/'}};"
  ],
  [ // 2. alert title
    'daily amount exceeds reference ceiling',
    "daily amount exceeds ${rule.typical?'typical maintenance range':'reference ceiling'}"
  ],
  [ // 3. alert explanation
    'above the ${rule.max} mg/day reference ceiling. This is not a recommended patient dose.',
    "above the ${rule.max} mg/day ${rule.typical?'typical maintenance maximum (warfarin is dosed by INR, so this is a review threshold, not a fixed ceiling)':'reference ceiling'}. This is not a recommended patient dose."
  ]
];

for (const [from, to] of edits) {
  if (src.split(from).length !== 2) {
    console.error('Could not find the expected code in safety.js, so NOTHING was changed.\nMissing text: ' + from.slice(0, 70) + '...');
    process.exit(1);
  }
}
fs.writeFileSync(file + '.bak', src);
for (const [from, to] of edits) src = src.replace(from, () => to);
fs.writeFileSync(file, src);
console.log('Done. Backup saved as backend/src/safety.js.bak');
