// Run from the project root (MongoDB must be running):  node fix-smiles.mjs
// Gives every medicine a molecular structure (SMILES) so the AI model can score its pairs.
import './backend/src/config.js';
import mongoose from 'mongoose';
import { Drug } from './backend/src/models.js';
import { mongoUri } from './backend/src/config.js';

// Structures for demo medicines that do not exist in the DDInter dataset.
const smiles = {
  aspirin: 'CC(=O)OC1=CC=CC=C1C(=O)O',
  metformin: 'CN(C)C(=N)N=C(N)N',
  paracetamol: 'CC(=O)NC1=CC=C(C=C1)O',
  simvastatin: 'CCC(C)(C)C(=O)OC1CC(C=C2C1C(C(C=C2)C)CCC3CC(CC(=O)O3)O)C',
  tramadol: 'CN(C)CC1CCCCC1(C2=CC(=CC=C2)OC)O',
  sildenafil: 'CCCC1=NN(C2=C1N=C(NC2=O)C3=C(C=CC(=C3)S(=O)(=O)N4CCN(CC4)C)OCC)C',
  nitroglycerin: 'C(C(CO[N+](=O)[O-])O[N+](=O)[O-])O[N+](=O)[O-]'
};
const missing = { $or: [{ smiles: { $exists: false } }, { smiles: '' }, { smiles: null }] };

await mongoose.connect(mongoUri);
let filled = 0;
for (const [canonicalId, s] of Object.entries(smiles)) {
  const r = await Drug.updateOne({ canonicalId, ...missing }, { $set: { smiles: s } });
  filled += r.modifiedCount;
}
// Demo copies of medicines that also exist in DDInter (warfarin, ibuprofen, ...) borrow the real structure.
for (const d of await Drug.find({ demo: true, ...missing }).lean()) {
  const real = await Drug.findOne({ demo: { $ne: true }, name: new RegExp('^' + d.name + '$', 'i'), smiles: { $nin: ['', null] } }).lean();
  if (real) { await Drug.updateOne({ _id: d._id }, { $set: { smiles: real.smiles } }); filled++; }
}
const still = await Drug.find(missing).select('name').lean();
console.log(`Structures added: ${filled}`);
console.log(still.length ? 'Still without structure: ' + still.map(d => d.name).join(', ') : 'Every medicine now has a structure.');
await mongoose.disconnect();
