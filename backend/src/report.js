// backend/src/report.js
// Hospital-style PDF report for a DrugAlert prescription analysis.
// Used by the GET /api/reports/:id route in server.js:  buildReport(res, prescription, drugs)
import PDFDocument from 'pdfkit';

const C = { teal: '#087f8c', dark: '#0f172a', text: '#334155', muted: '#64748b', line: '#cbd5e1', soft: '#f1f5f9', zebra: '#f8fafc' };
const SEV = {
  High: { fg: '#be123c', bg: '#fff1f2' },
  Moderate: { fg: '#b45309', bg: '#fffbeb' },
  Low: { fg: '#047857', bg: '#ecfdf5' }
};
const M = 40; // page margin

const num = n => Number(Number(n).toFixed(2));
const listText = a => { const x = Array.from(a || []).filter(Boolean); return x.length ? x.join(', ') : 'None recorded'; };
// Times are shown in Indian Standard Time. Change 'Asia/Kolkata' if you deploy elsewhere.
const when = d => d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).replace(/am|pm/, s => s.toUpperCase()) + ' IST';
const reportNo = (p, d) => `DA-${d.getFullYear()}-${String(p._id).slice(-6).toUpperCase()}`;

// Default schedule derived ONLY from the number of doses per day (no clinical instructions are invented).
const hhmm = h => String(Math.floor(h) % 24).padStart(2, '0') + ':' + String(Math.round((h % 1) * 60)).padStart(2, '0');
function schedule(n) {
  const fixed = {
    1: ['Morning 08:00'],
    2: ['Morning 08:00', 'Night 20:00'],
    3: ['Morning 08:00', 'Afternoon 14:00', 'Night 20:00'],
    4: ['Morning 06:00', 'Noon 12:00', 'Evening 18:00', 'Night 22:00']
  };
  if (fixed[n]) return fixed[n];
  return Array.from({ length: n }, (_, i) => hhmm(6 + i * (24 / n)));
}

const bottom = doc => doc.page.height - 56;
const need = (doc, h) => { if (doc.y + h > bottom(doc)) doc.addPage(); };

function section(doc, title, minSpace = 70) {
  need(doc, minSpace);
  doc.y += 10;
  const y = doc.y, W = doc.page.width - 2 * M;
  doc.rect(M, y, 3, 13).fill(C.teal);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(C.dark).text(title.toUpperCase(), M + 9, y + 1, { width: W - 9, characterSpacing: 0.5 });
  doc.moveTo(M, y + 19).lineTo(M + W, y + 19).lineWidth(0.6).strokeColor(C.line).stroke();
  doc.y = y + 26;
}

function kvTable(doc, rows) {
  const W = doc.page.width - 2 * M, lw = 120, pad = 6, vw = W - lw - pad * 2;
  for (const [k, v] of rows) {
    doc.font('Helvetica').fontSize(9.5);
    const h = Math.max(doc.heightOfString(String(v), { width: vw }), 12) + pad * 2;
    need(doc, h);
    const y = doc.y;
    doc.rect(M, y, lw, h).fill(C.soft);
    doc.rect(M, y, W, h).lineWidth(0.5).strokeColor(C.line).stroke();
    doc.moveTo(M + lw, y).lineTo(M + lw, y + h).stroke();
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.muted).text(String(k).toUpperCase(), M + pad, y + pad + 1, { width: lw - pad * 2 });
    doc.font('Helvetica').fontSize(9.5).fillColor(C.dark).text(String(v), M + lw + pad, y + pad, { width: vw });
    doc.y = y + h;
  }
}

function medTable(doc, meds, byId) {
  const W = doc.page.width - 2 * M;
  const widths = [22, 148, 62, 48, 58, 38];
  widths.push(W - widths.reduce((a, b) => a + b, 0));
  const heads = ['#', 'Medicine', 'Dose per intake', 'Times per day', 'Daily total', 'Days', 'Time to take'];
  const xs = []; let x = M; for (const w of widths) { xs.push(x); x += w; }
  const head = () => {
    const y = doc.y;
    doc.rect(M, y, W, 28).fill(C.teal);
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
    heads.forEach((t, i) => doc.text(t, xs[i] + 5, y + 6, { width: widths[i] - 10 }));
    doc.y = y + 28;
  };
  need(doc, 60); head();
  meds.forEach((m, i) => {
    const d = byId.get(m.drugId) || {};
    const name = d.name || m.drugId;
    const brands = (d.brands || []).slice(0, 3).join(', ');
    const times = schedule(m.frequency);
    doc.font('Helvetica-Bold').fontSize(9.5);
    const hn = doc.heightOfString(name, { width: widths[1] - 10 });
    doc.font('Helvetica').fontSize(8);
    const hb = brands ? doc.heightOfString(brands, { width: widths[1] - 10 }) : 0;
    doc.fontSize(9);
    const ht = doc.heightOfString(times.join('\n'), { width: widths[6] - 10 });
    const h = Math.max(hn + hb, ht, 12) + 14;
    if (doc.y + h > bottom(doc)) { doc.addPage(); head(); }
    const y = doc.y;
    if (i % 2 === 0) doc.rect(M, y, W, h).fill(C.zebra);
    doc.moveTo(M, y + h).lineTo(M + W, y + h).lineWidth(0.5).strokeColor(C.line).stroke();
    const t = y + 7;
    doc.font('Helvetica').fontSize(9).fillColor(C.dark);
    doc.text(String(i + 1), xs[0] + 5, t, { width: widths[0] - 8 });
    doc.font('Helvetica-Bold').fontSize(9.5).text(name, xs[1] + 5, t, { width: widths[1] - 10 });
    if (brands) doc.font('Helvetica').fontSize(8).fillColor(C.muted).text(brands, xs[1] + 5, t + hn, { width: widths[1] - 10 });
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.dark).text(`${num(m.doseMg)} mg`, xs[2] + 5, t, { width: widths[2] - 10 });
    doc.font('Helvetica').fontSize(9.5).text(`${m.frequency} x`, xs[3] + 5, t, { width: widths[3] - 10 });
    doc.text(`${num(m.doseMg * m.frequency)} mg`, xs[4] + 5, t, { width: widths[4] - 10 });
    doc.text(String(m.durationDays), xs[5] + 5, t, { width: widths[5] - 10 });
    doc.fontSize(9).text(times.join('\n'), xs[6] + 5, t, { width: widths[6] - 10 });
    doc.y = y + h;
  });
  doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(C.muted).text(
    'Times are a default schedule worked out from the number of doses per day. The prescriber must confirm the exact timing and instructions (for example before or after food).',
    M, doc.y + 5, { width: W });
}

function summary(doc, a, meds) {
  const W = doc.page.width - 2 * M, gap = 8, bw = (W - gap * 3) / 4;
  need(doc, 100);
  const y = doc.y;
  const high = a.alerts.filter(x => x.severity === 'High').length;
  const mod = a.alerts.filter(x => x.severity === 'Moderate').length;
  const low = a.alerts.filter(x => x.severity === 'Low').length;
  const overall = a.overallSeverity || 'No alerts';
  const boxes = [
    ['Overall risk', overall, (SEV[overall] || {}).fg || C.text],
    ['Medicines', String(a.medicationCount ?? meds.length), C.dark],
    ['Pairs checked', String(a.pairCount ?? 0), C.dark],
    ['Unassessed pairs', String((a.unknownPairs || []).length), (a.unknownPairs || []).length ? SEV.Moderate.fg : C.dark]
  ];
  boxes.forEach(([label, value, color], i) => {
    const x = M + i * (bw + gap);
    doc.rect(x, y, bw, 46).lineWidth(0.5).strokeColor(C.line).stroke();
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.muted).text(label.toUpperCase(), x + 8, y + 8, { width: bw - 16 });
    doc.font('Helvetica-Bold').fontSize(16).fillColor(color).text(value, x + 8, y + 22, { width: bw - 16 });
  });
  doc.y = y + 56;
  doc.font('Helvetica').fontSize(9.5).fillColor(C.dark).text(
    `${a.alerts.length} alert(s): ${high} High, ${mod} Moderate, ${low} Low.`, M, doc.y, { width: W });
  doc.font('Helvetica').fontSize(9).fillColor(C.text).text(a.summary || '', M, doc.y + 3, { width: W });
  if (a.coverageComplete === false)
    doc.font('Helvetica-Bold').fontSize(9).fillColor(SEV.Moderate.fg).text(
      'Assessment incomplete: some pair or dose checks need professional review.', M, doc.y + 4, { width: W });
}

function alertCard(doc, a) {
  const W = doc.page.width - 2 * M, pad = 10, tw = W - pad * 2 - 6;
  const sev = SEV[a.severity] || SEV.Low;
  const parts = [
    { t: `${String(a.type || '').toUpperCase()}   |   ${String(a.severity || '').toUpperCase()}`, f: 'Helvetica-Bold', s: 7.5, c: sev.fg },
    { t: a.title, f: 'Helvetica-Bold', s: 10.5, c: C.dark },
    { t: a.explanation, f: 'Helvetica', s: 9, c: C.text },
    { t: 'Action: ' + a.precaution, f: 'Helvetica', s: 9, c: C.text }
  ];
  if (a.prediction && a.prediction.confidence != null)
    parts.push({ t: `Model confidence: ${(a.prediction.confidence * 100).toFixed(1)}% (statistical estimate; not proof of an interaction)`, f: 'Helvetica-Oblique', s: 8.5, c: C.text });
  if (a.demo) parts.push({ t: 'Demonstration fixture: not independently verified.', f: 'Helvetica-Oblique', s: 8.5, c: SEV.Moderate.fg });
  if (a.patientFactors && a.patientFactors.length) parts.push({ t: 'Patient factors: ' + a.patientFactors.join('; '), f: 'Helvetica', s: 8.5, c: C.text });
  parts.push({ t: 'Evidence: ' + a.source, f: 'Helvetica', s: 7.5, c: C.muted });
  let h = pad * 2 - 3;
  for (const p of parts) { doc.font(p.f).fontSize(p.s); p.h = doc.heightOfString(String(p.t), { width: tw }); h += p.h + 3; }
  need(doc, h + 8);
  const y = doc.y;
  doc.rect(M, y, W, h).fill(sev.bg);
  doc.rect(M, y, 3, h).fill(sev.fg);
  let yy = y + pad;
  for (const p of parts) { doc.font(p.f).fontSize(p.s).fillColor(p.c).text(String(p.t), M + pad + 6, yy, { width: tw }); yy += p.h + 3; }
  doc.y = y + h + 8;
}

function signoff(doc) {
  const W = doc.page.width - 2 * M, bw = (W - 12) / 2;
  need(doc, 140);
  doc.y += 6;
  const y = doc.y;
  [['Prescribing doctor', 0], ['Pharmacist review', 1]].forEach(([label, i]) => {
    const x = M + i * (bw + 12);
    doc.rect(x, y, bw, 70).lineWidth(0.5).strokeColor(C.line).stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.muted).text(label.toUpperCase(), x + 8, y + 8, { width: bw - 16 });
    doc.moveTo(x + 8, y + 48).lineTo(x + bw - 8, y + 48).lineWidth(0.5).strokeColor(C.muted).stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor(C.muted).text('Name / Signature / Date', x + 8, y + 52, { width: bw - 16 });
  });
  doc.y = y + 80;
}

export function buildReport(res, p, drugs) {
  const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true });
  doc.pipe(res);
  const now = new Date();
  const W = doc.page.width - 2 * M;
  const a = p.analysis || { alerts: [], unknownPairs: [], doseAssessments: [] };
  const patient = p.patient || {};
  const byId = new Map((drugs || []).map(d => [d.canonicalId, d]));
  const no = reportNo(p, now);

  // Header band
  doc.rect(0, 0, doc.page.width, 84).fill(C.teal);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text('DrugAlert', M, 24);
  doc.font('Helvetica').fontSize(10).text('Prescription Safety Report', M, 52);
  doc.font('Helvetica-Bold').fontSize(9).text(`Report No.  ${no}`, M + W - 230, 26, { width: 230, align: 'right' });
  doc.font('Helvetica').fontSize(8.5).text(`Generated  ${when(now)}`, M + W - 230, 42, { width: 230, align: 'right' });
  doc.y = 100;

  section(doc, 'Patient details');
  kvTable(doc, [
    ['Patient name', patient.name || 'Not recorded'],
    ['Age / Sex', `${patient.age ?? 'Not recorded'} years  /  ${patient.sex || 'Not recorded'}`],
    ['Known allergies', listText(patient.allergies)],
    ['Medical conditions', listText(patient.conditions)],
    ['Clinical history', (patient.history || '').trim() || 'None recorded']
  ]);

  section(doc, 'Prescribed medicines', 130);
  medTable(doc, Array.from(p.medications || []), byId);

  if ((a.doseAssessments || []).length) {
    section(doc, 'Daily dose check');
    kvTable(doc, a.doseAssessments.map(d => {
      if (d.status === 'unassessed' || d.referenceMaxMg == null)
        return [d.drug, `${num(d.dailyMg)} mg/day entered. No verified dose reference available: dose not checked.`];
      const over = d.dailyMg > d.referenceMaxMg;
      return [d.drug, `${num(d.dailyMg)} mg/day entered. Reference maximum ${num(d.referenceMaxMg)} mg/day: ${over ? 'EXCEEDS the reference' : 'within the reference'}.`];
    }));
  }

  section(doc, 'Safety summary');
  summary(doc, a, p.medications || []);

  section(doc, 'Alerts', 200);
  if (!a.alerts.length) doc.font('Helvetica').fontSize(9.5).fillColor(C.text).text('No alerts in the available evidence. This does not establish safety.', M, doc.y, { width: W });
  for (const sev of ['High', 'Moderate', 'Low']) {
    const group = a.alerts.filter(x => x.severity === sev);
    if (!group.length) continue;
    need(doc, 150);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(SEV[sev].fg).text(`${sev.toUpperCase()}  (${group.length})`, M, doc.y, { width: W });
    doc.y += 4;
    group.forEach(g => alertCard(doc, g));
  }

  if ((a.unknownPairs || []).length) {
    section(doc, 'Unassessed combinations');
    kvTable(doc, a.unknownPairs.map(u => [u.drugs.join(' + '), u.reason]));
  }

  section(doc, 'Review and sign-off', 185);
  signoff(doc);
  doc.font('Helvetica-Oblique').fontSize(8).fillColor(C.muted).text(a.disclaimer || 'Academic decision-support prototype. Not clinically validated; does not diagnose, prescribe or replace a doctor/pharmacist.', M, doc.y, { width: W });

  // Footer on every page
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // allows writing in the bottom margin without a new page
    const fy = doc.page.height - 34;
    doc.moveTo(M, fy - 6).lineTo(M + W, fy - 6).lineWidth(0.5).strokeColor(C.line).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(C.muted).text(`DrugAlert  |  ${no}  |  Academic decision-support prototype`, M, fy, { width: W - 80, lineBreak: false });
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, M + W - 80, fy, { width: 80, align: 'right', lineBreak: false });
  }
  doc.end();
}
