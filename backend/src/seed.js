import './config.js';import mongoose from 'mongoose';import {Drug,Interaction,AdrSignal} from './models.js';import {mongoUri} from './config.js';import {pairKey} from './safety.js';
// Fictional demonstration fixtures, deliberately separated from training data.
export const fixtures=[
 ['aspirin','Aspirin',['Disprin','Ecosprin'],'NSAID',['peptic ulcer'],'Gastrointestinal irritation'],
 ['warfarin','Warfarin',['Warf'],'Anticoagulant',['active bleeding'],'Bleeding'],
 ['ibuprofen','Ibuprofen',['Brufen'],'NSAID',['kidney disease'],'Gastrointestinal irritation'],
 ['metformin','Metformin',['Glycomet'],'Antidiabetic',['severe kidney disease'],'Nausea'],
 ['paracetamol','Paracetamol',['Dolo','Crocin'],'Analgesic',['severe liver disease'],'Liver injury signal'],
 ['lisinopril','Lisinopril',['Listril'],'ACE inhibitor',['pregnancy'],'Dry cough'],
 ['spironolactone','Spironolactone',['Aldactone'],'Diuretic',['hyperkalemia'],'High potassium'],
 ['simvastatin','Simvastatin',['Simcard'],'Statin',['active liver disease'],'Muscle pain'],
 ['clarithromycin','Clarithromycin',['Claribid'],'Macrolide',['QT prolongation'],'Nausea'],
 ['sertraline','Sertraline',['Serlift'],'SSRI',[],'Nausea'],
 ['tramadol','Tramadol',['Tramazac'],'Opioid',['seizure disorder'],'Drowsiness'],
 ['sildenafil','Sildenafil',['Manforce'],'PDE5 inhibitor',['severe hypotension'],'Headache'],
 ['nitroglycerin','Nitroglycerin',['Nitrocontin'],'Nitrate',['severe hypotension'],'Headache']
];
await mongoose.connect(mongoUri);for(const [canonicalId,name,brands,drugClass,contraindications,effect] of fixtures){await Drug.updateOne({canonicalId},{$setOnInsert:{canonicalId,name,brands,drugClass,contraindications,sideEffects:[effect],composition:name,dosage:'No prescribing dosage guidance provided.',source:'Educational demonstration fixture; verify brand composition against product label.',demo:true}},{upsert:true});await AdrSignal.updateOne({drugId:canonicalId,effect},{$setOnInsert:{drugId:canonicalId,effect,source:'Educational demonstration fixture; not imported SIDER evidence',signalType:'demo'}},{upsert:true});}
for(const [drugA,drugB,severity,mechanism] of [['aspirin','warfarin','High','Demonstration of a bleeding interaction alert.'],['ibuprofen','warfarin','High','Demonstration of a bleeding interaction alert.'],['lisinopril','spironolactone','High','Demonstration of a potassium-related interaction alert.'],['simvastatin','clarithromycin','High','Demonstration of a metabolism-related interaction alert.'],['sertraline','tramadol','High','Demonstration of a serotonin-related interaction alert.'],['sildenafil','nitroglycerin','High','Demonstration of a hypotension interaction alert.']])await Interaction.updateOne({pairKey:pairKey(drugA,drugB)},{$setOnInsert:{pairKey:pairKey(drugA,drugB),drugA,drugB,severity,mechanism,management:'Seek qualified review. Demonstration information must be verified.',source:'Educational demonstration fixture, not DDInter dataset evidence',demo:true}},{upsert:true});
console.log('Seeded 13 demonstration drugs. No model was trained or metrics fabricated.');await mongoose.disconnect();
