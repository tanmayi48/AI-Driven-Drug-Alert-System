// Run from the project root:  node apply-report.mjs
// 1) copies report.js (next to this file) to backend/src/report.js
// 2) switches the PDF download in backend/src/server.js to the new hospital-style report.
// Makes a backup (server.js.bak3) and changes nothing if the expected code is not found.
import fs from 'node:fs';

const server = 'backend/src/server.js';
if (!fs.existsSync(server) || !fs.existsSync('report.js')) {
  console.error('Run this from the project root, with report.js in the same folder as this script.');
  process.exit(1);
}
fs.copyFileSync('report.js', 'backend/src/report.js');
let src = fs.readFileSync(server, 'utf8');
if (src.includes('buildReport(')) { console.log('server.js already uses the new report. report.js was refreshed.'); process.exit(0); }

const importFrom = "import {analyze} from './safety.js';";
const startMark = "const doc=new PDFDocument({margin:48,bufferPages:true});";
const endMark = "doc.end();";
const a = src.indexOf(startMark);
const b = a < 0 ? -1 : src.indexOf(endMark, a);
const block = b < 0 ? '' : src.slice(a, b + endMark.length);
if (src.split(importFrom).length !== 2 || src.split(startMark).length !== 2 || !block.includes('Safety report')) {
  console.error('Could not find the old report code in server.js, so NOTHING was changed in server.js.');
  process.exit(1);
}
const replacement = "const drugs=await Drug.find({canonicalId:{$in:p.medications.map(m=>m.drugId)}}).lean();buildReport(r,p,drugs);";
fs.writeFileSync(server + '.bak3', src);
src = src.replace(block, () => replacement).replace(importFrom, () => importFrom + "import {buildReport} from './report.js';");
fs.writeFileSync(server, src);
console.log('Done. New report installed. Backup saved as backend/src/server.js.bak3');
