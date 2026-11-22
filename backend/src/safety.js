export const pairKey=(a,b)=>[a,b].sort().join('|');
const norm=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
const aliases={'ckd':'kidney disease','chronic kidney disease':'kidney disease','renal impairment':'kidney disease','renal disease':'kidney disease','hepatic disease':'liver disease','acetaminophen':'paracetamol'};
const canonical=s=>aliases[norm(s)]||norm(s);
const doseRules={paracetamol:{max:4000,minAge:12,source:'https://www.fda.gov/drugs/safe-use-over-counter-pain-relievers-and-fever-reducers/acetaminophen'},ibuprofen:{max:3200,minAge:18,source:'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=72ec2491-924d-460f-9510-62d624d54b59'},meloxicam:{max:15,minAge:18,source:'https://www.medicines.org.uk/emc/medicine/105271/spc'},warfarin:{max:10,minAge:18,typical:true,source:'https://medlibrary.org/lib/rx/meds/warfarin-sodium-42/'},aspirin:{max:3900,minAge:12,source:'https://otclabels.com/lib/otc/otc-meds/aspirin-325mg-1/'}};

export async function analyze(patient,medications,drugs,interactions,adrSignals,predict){
 const alerts=[],unknownPairs=[],doseAssessments=[];const byId=new Map(drugs.map(d=>[d.canonicalId,d]));
 const add=(type,severity,title,explanation,precaution,names,source,extra={})=>alerts.push({type,severity,title,explanation,precaution,drugs:names,source,...extra});
 const unique=[...new Set(medications.map(m=>m.drugId))];
 for(const id of unique){
  const d=byId.get(id);if(!d)throw new Error('Unknown medicine');
  const names=[d.name];
  const key=canonical(d.name),rule=doseRules[key];
  const entries=medications.filter(m=>canonical(byId.get(m.drugId)?.name)===key);
  const dailyMg=entries.reduce((sum,m)=>sum+m.doseMg*m.frequency,0);
  const factors=[];
  const supported=rule&&patient.age>=rule.minAge;
  doseAssessments.push({drug:d.name,dailyMg,status:supported?'reference-screened':'unassessed',referenceMaxMg:supported?rule.max:undefined});
  if(supported&&dailyMg>rule.max)add('Dose','High',`${d.name}: daily amount exceeds ${rule.typical?'typical maintenance range':'reference ceiling'}`,`${entries.map(m=>`${m.doseMg} mg x ${m.frequency}/day`).join(' + ')} = ${dailyMg} mg/day, above the ${rule.max} mg/day ${rule.typical?'typical maintenance maximum (warfarin is dosed by INR, so this is a review threshold, not a fixed ceiling)':'reference ceiling'}. This is not a recommended patient dose.`,'Verify the amount, units and product with a clinician or pharmacist before use.',names,rule.source,{patientFactors:[`Age ${patient.age}; total across matching ingredient entries`]});
  if(!supported)add('Dose review','Moderate',`${d.name}: dose needs verification`,`${dailyMg} mg/day entered. No applicable verified dose ceiling is available for this medicine and age. Route, formulation, indication, weight and organ function may change dosing.`,'Have a pharmacist check the exact product and dose; this amount has not been cleared.',names,'Dose coverage check; no clinical dose reference available');
  if(key==='ibuprofen'){
   factors.push(...(patient.conditions||[]).filter(c=>['kidney disease','severe kidney disease','heart failure','liver disease'].includes(canonical(c))));
   if(patient.age>=65)factors.push(`Age ${patient.age}: older adult`);
   if(factors.length)add('Patient risk','High',`${d.name}: increased renal-risk review`,`${d.name} can reduce renal perfusion. Recorded risk factors: ${factors.join(', ')}. These factors require review independently of pair severity.`,'Review renal function, fluid status and the exact regimen with the treating professional.',names,doseRules.ibuprofen.source,{patientFactors:factors});
  }

  if((patient.allergies||[]).some(a=>[d.name,d.drugClass,...(d.brands||[])].map(canonical).includes(canonical(a))))add('Allergy','High',`Allergy conflict: ${d.name}`,'Recorded allergy matches the medicine or its class.','Review the recorded allergy with a qualified professional.',names,d.source);
  for(const c of d.contraindications||[])if((patient.conditions||[]).map(canonical).includes(canonical(c)))add('Contraindication','High',`${d.name}: ${c}`,`${d.name} has a stored contraindication for ${c}, which matches this patient's record.`,'Qualified clinical review is required.',names,d.source);
  if(medications.filter(m=>m.drugId===id).length>1)add('Duplicate therapy','Moderate',`Repeated ${d.name}`,'The same active medicine appears multiple times.','Review and consolidate entries.',names,d.source);
  const signals=adrSignals.filter(a=>a.drugId===id);
  if(signals.length)add('ADR signal','Low',`${d.name}: ${signals.length} adverse-effect associations`,`Label-derived associations include ${signals.slice(0,5).map(s=>s.effect).join(', ')}. These are not patient events; occurrence and causality are not established. Grouped to reduce alert fatigue.`,'Discuss relevant symptoms with the treating professional.',names,[...new Set(signals.map(s=>s.source))].join('; '),{adrEffects:signals.map(s=>s.effect)});
 }
 for(let i=0;i<unique.length;i++)for(let j=i+1;j<unique.length;j++){
  const a=byId.get(unique[i]),b=byId.get(unique[j]),names=[a.name,b.name];
  if(a.drugClass&&a.drugClass===b.drugClass)add('Duplicate therapy','Moderate',`${names.join(' + ')}: shared class`,'Both medicines belong to the same stored therapeutic class.','Review whether combination therapy is intentional.',names,`${a.source}; ${b.source}`);
  const evidence=interactions.find(x=>x.pairKey===pairKey(unique[i],unique[j]));
  if(evidence)add('Known DDI',evidence.severity,names.join(' + '),evidence.mechanism||'Mechanism not provided in source export.',evidence.management||'Source export does not provide management; obtain qualified review.',names,evidence.source,{demo:!!evidence.demo});
  else {let prediction;try{prediction=await predict(a,b);}catch{prediction={available:false,reason:'Prediction service failed for this pair'};}if(prediction.available)add('Model DDI',prediction.severity,names.join(' + '),'Dataset-trained severity prediction for an unseen pair; interaction existence is not established.','Model output requires qualified review.',names,'Project trained model',{prediction});else unknownPairs.push({drugs:names,reason:prediction.reason});}
 }
 const factors=[];if(unique.length>=5)factors.push('Polypharmacy: at least five distinct medicines');
 for(const a of alerts){a.patientFactors=[...(a.patientFactors||[]),...factors];if(a.type==='Allergy'||a.type==='Contraindication')a.patientFactors.push('Direct patient-record match');a.priority=({High:3,Moderate:2,Low:1}[a.severity])*10+(['Allergy','Dose','Contraindication','Patient risk'].includes(a.type)?5:0)+a.patientFactors.length;}
 alerts.sort((a,b)=>b.priority-a.priority);
 return {alerts,unknownPairs,doseAssessments,overallSeverity:alerts[0]?.severity||(unknownPairs.length?'Unassessed':'No alerts'),pairCount:unique.length*(unique.length-1)/2,medicationCount:unique.length,coverageComplete:unknownPairs.length===0&&doseAssessments.every(d=>d.status!=='unassessed'),summary:unknownPairs.length?'Some medicine pairs remain unassessed. Absence of an alert does not establish safety.':alerts.length?'Evidence and safety signals require review.':'No alerts in the available evidence. This does not establish safety.',disclaimer:'Academic decision-support prototype. Not clinically validated; does not diagnose, prescribe or replace a doctor/pharmacist.'};
}
