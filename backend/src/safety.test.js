import test from 'node:test';import assert from 'node:assert/strict';import {analyze,pairKey} from './safety.js';
const drugs=[{canonicalId:'a',name:'Alpha',drugClass:'NSAID',contraindications:['kidney disease'],source:'test evidence'},{canonicalId:'b',name:'Beta',drugClass:'Other',contraindications:[],source:'test evidence'},{canonicalId:'c',name:'Gamma',drugClass:'NSAID',contraindications:[],source:'test evidence'}];
const patient={age:40,allergies:[],conditions:[]};const meds=ids=>ids.map(drugId=>({drugId,doseMg:10,frequency:1,durationDays:7}));const unavailable=async()=>({available:false,reason:'No model'});
test('unordered pair normalization',()=>assert.equal(pairKey('b','a'),pairKey('a','b')));
test('known DDI retains severity and evidence',async()=>{const r=await analyze(patient,meds(['a','b']),drugs,[{pairKey:'a|b',severity:'High',mechanism:'Known effect',source:'DDInter',management:'Review'}],[],unavailable);assert.equal(r.alerts[0].type,'Known DDI');assert.equal(r.alerts[0].source,'DDInter');assert.equal(r.unknownPairs.length,0);});
test('missing prediction is explicitly unassessed',async()=>{const r=await analyze(patient,meds(['a','b']),drugs,[],[],unavailable);assert.equal(r.coverageComplete,false);assert.equal(r.unknownPairs.length,1);assert.match(r.summary,/unassessed/);});
test('allergy and exact condition matches',async()=>{const r=await analyze({...patient,allergies:['nsaid'],conditions:['kidney disease']},meds(['a']),drugs,[],[],unavailable);assert.equal(r.alerts.filter(a=>a.severity==='High').length,2);});
test('partial condition names never create contraindication',async()=>{const r=await analyze({...patient,conditions:['kidney']},meds(['a']),drugs,[],[],unavailable);assert.equal(r.alerts.filter(a=>a.type==='Contraindication').length,0);});
test('duplicate ingredients and therapy class',async()=>{const r=await analyze(patient,meds(['a','a','c']),drugs,[],[],unavailable);assert.equal(r.alerts.filter(a=>a.type==='Duplicate therapy').length,2);assert.equal(r.pairCount,1);});
test('unknown drug rejected',async()=>{await assert.rejects(analyze(patient,meds(['missing']),drugs,[],[],unavailable),/Unknown medicine/);});
test('prediction is labeled model output with confidence',async()=>{const r=await analyze(patient,meds(['a','b']),drugs,[],[],async()=>({available:true,severity:'Moderate',confidence:0.7,explanation:[]}));const model=r.alerts.find(a=>a.type==='Model DDI');assert.match(model.explanation,/not established/);assert.equal(model.prediction.confidence,0.7);});
// Forty fictional scenarios exercise known DDI, allergy, contraindication,
// polypharmacy/duplicate and unsupported-pair paths without claiming clinical truth.
for(let i=0;i<40;i++)test(`fictional prescription scenario ${i+1}`,async()=>{const p={...patient,age:18+i,allergies:i%4===0?['NSAID']:[],conditions:i%5===0?['kidney disease']:[]};const r=await analyze(p,meds(i%3===0?['a','b','c']:['a','b']),drugs,i%2===0?[{pairKey:'a|b',severity:'High',mechanism:'Fixture',source:'Test fixture',management:'Review'}]:[],i%7===0?[{drugId:'a',effect:'Fixture adverse effect',source:'Test fixture'}]:[],unavailable);assert.equal(r.medicationCount,i%3===0?3:2);assert.equal(r.alerts.some(a=>a.type==='Allergy'),i%4===0);assert.equal(r.alerts.some(a=>a.type==='Contraindication'),i%5===0);assert.ok(r.alerts.every(a=>a.source));});

test('daily dose aggregates repeated ingredient entries and ranks first',async()=>{
 const ds=[{canonicalId:'p',name:'Paracetamol',source:'test'}];
 const r=await analyze(patient,[{drugId:'p',doseMg:1000,frequency:3},{drugId:'p',doseMg:1000,frequency:2}],ds,[],[],unavailable);
 assert.equal(r.alerts[0].type,'Dose');assert.equal(r.alerts[0].severity,'High');assert.match(r.alerts[0].explanation,/5000 mg/);
});
test('CKD alias and older age trigger ibuprofen patient review',async()=>{
 const r=await analyze({...patient,age:70,conditions:['CKD']},meds(['i']),[{canonicalId:'i',name:'Ibuprofen',contraindications:['kidney disease'],source:'test'}],[],[],unavailable);
 assert.ok(r.alerts.some(a=>a.type==='Contraindication'));assert.ok(r.alerts.some(a=>a.type==='Patient risk'&&a.patientFactors.includes('CKD')));
});
test('unsupported dose is never silently cleared',async()=>{
 const r=await analyze(patient,meds(['a']),drugs,[],[],unavailable);assert.equal(r.coverageComplete,false);assert.ok(r.alerts.some(a=>a.type==='Dose review'));
});
test('three medicines assess every unordered pair even if predictor fails',async()=>{
 let calls=0;const r=await analyze(patient,meds(['a','b','c']),drugs,[],[],async()=>{calls++;throw new Error('offline');});assert.equal(calls,3);assert.equal(r.pairCount,3);assert.equal(r.unknownPairs.length,3);
});
test('pediatric input does not inherit adult dose ceiling',async()=>{
 const r=await analyze({...patient,age:8},meds(['i']),[{canonicalId:'i',name:'Ibuprofen',source:'test'}],[],[],unavailable);assert.equal(r.doseAssessments[0].status,'unassessed');
});
