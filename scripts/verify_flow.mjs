import assert from 'node:assert/strict';import fs from 'node:fs';
const base='http://127.0.0.1:4000/api';let token='';
async function request(path,body,expected=200){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:body?JSON.stringify(body):undefined});assert.equal(r.status,expected,path);return r.json();}
assert.equal((await request('/health')).database,true);
const account={name:'Fictional Verification User',email:`verify-${Date.now()}@example.test`,password:'Test-only-password-2026'};
token=(await request('/auth/register',account,201)).token;
const patient=await request('/patients',{name:'Fictional Demo Patient',age:70,sex:'Female',allergies:['NSAID'],conditions:['kidney disease'],history:'Fictional academic verification'},201);
const selected=await request('/drugs/search?q=aspirin');assert.ok(selected.length);
const fixture=selected.find(d=>d.canonicalId==='aspirin');assert.ok(fixture);
const rx=await request('/prescriptions',{patientId:patient._id,medications:[{drugId:'aspirin',doseMg:10,frequency:1,durationDays:7},{drugId:'warfarin',doseMg:10,frequency:1,durationDays:7}]},201);
const analysis=await request(`/prescriptions/${rx._id}/analyze`,{});assert.ok(analysis.alerts.some(a=>a.type==='Known DDI'));assert.ok(analysis.alerts.some(a=>a.type==='Allergy'));
const report=await fetch(`${base}/reports/${rx._id}`,{headers:{Authorization:'Bearer '+token}});assert.equal(report.status,200);const bytes=Buffer.from(await report.arrayBuffer());assert.equal(bytes.subarray(0,4).toString(),'%PDF');fs.writeFileSync('docs/sample-report.pdf',bytes);
const chat=await request('/chat',{question:'Why was this aspirin prescription flagged?',prescriptionId:rx._id});assert.ok(chat.sources.length);assert.ok(chat.answer);
const unsupported=await request('/chat',{question:'Explain quantum entanglement in distant galaxies'});assert.equal(unsupported.mode,'insufficient-evidence');
const info=await request('/model-info');assert.equal(info.trained,true);assert.equal(info.models.length,3);
const imported=JSON.parse(fs.readFileSync('data/processed/import.json','utf8'));const knownPairs=new Set(imported.interactions.map(i=>i.pairKey));let unseen;
outer:for(const a of imported.drugs)for(const b of imported.drugs)if(a.canonicalId!==b.canonicalId&&a.smiles&&b.smiles&&!knownPairs.has([a.canonicalId,b.canonicalId].sort().join('|'))){unseen=[a,b];break outer;}
assert.ok(unseen);const prediction=await request('/ai/ddi-predict',{drugA:unseen[0].canonicalId,drugB:unseen[1].canonicalId});assert.equal(prediction.available,true);assert.ok(prediction.confidence>=0&&prediction.confidence<=1);assert.equal(prediction.explanation.length,5);
const realPair=imported.interactions[0];const realRx=await request('/prescriptions',{patientId:patient._id,medications:[realPair.drugA,realPair.drugB].map(drugId=>({drugId,doseMg:10,frequency:1,durationDays:7}))},201);const realAnalysis=await request(`/prescriptions/${realRx._id}/analyze`,{});assert.ok(realAnalysis.alerts.some(a=>a.type==='Known DDI'&&a.source.includes('DDInter')&&!a.demo));assert.ok(realAnalysis.alerts.some(a=>a.type==='ADR signal'&&a.source.includes('SIDER')));
const unseenRx=await request('/prescriptions',{patientId:patient._id,medications:unseen.map(d=>({drugId:d.canonicalId,doseMg:10,frequency:1,durationDays:7}))},201);const unseenAnalysis=await request(`/prescriptions/${unseenRx._id}/analyze`,{});assert.ok(unseenAnalysis.alerts.some(a=>a.type==='Model DDI'));
// Confirm owner isolation with an independently registered account.
const firstToken=token;token=(await request('/auth/register',{...account,email:`other-${Date.now()}@example.test`},201)).token;await request(`/alerts/${rx._id}`,undefined,404);token=firstToken;
const summary=await request('/dashboard/summary');assert.equal(summary.patientCount,1);assert.equal(summary.prescriptionCount,3);
const evidence={verifiedAt:new Date().toISOString(),checks:['registration','patient creation','generic search','known DDI','allergy','persisted analysis','PDF','grounded chat','unsupported question','three model metadata','live unseen-pair prediction','owner isolation','dashboard'],unseenPair:unseen.map(d=>d.name),predictionModel:prediction.model,chatMode:chat.mode,pdfBytes:bytes.length};fs.writeFileSync('docs/integration-results.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
