# Dataset provenance and dictionary

| Source | Snapshot | License |
|---|---|---|
| DDInter | 2.0 official code B export; https://ddinter2.scbdd.com/download/ | CC BY-NC-SA 4.0; https://ddinter2.scbdd.com/terms/ |
| SIDER | 4.1 (2015-10-21); https://sideeffects.embl.de/download/ | CC BY-SA 4.0 MedDRA mapping |
| PubChem | Live PUG REST structure snapshot; https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest | Source-specific annotation terms may apply |

Actual SHA-256 and retrieval dates: `data/raw/manifest.json`. Structure snapshot: `data/raw/pubchem_cache.json`. Normalized metadata: `data/processed/import.json`.

DDInter columns: DDInterID_A, Drug_A, DDInterID_B, Drug_B, Level. Minor→Low, Moderate→Moderate, Major→High. Unknown labels are excluded. Deduplicate unordered pairs and discard conflicting labels. The bulk CSV has no mechanism/management; imported alerts identify these missing fields honestly.

SIDER columns: flat PubChem ID, stereo PubChem ID, UMLS label concept, MedDRA concept type, concept ID, side-effect name. Preferred terms (PT) are used. Flat CID100... maps to PubChem by subtracting 100,000,000. Official generic-name matches choose a bounded connected DDInter subset. Associations do not establish individual causality or frequency.

Normalized drug: canonical DDInter ID, generic name, CID, connectivity SMILES, source. Missing class/brand/condition/dosage annotations remain missing. Separate educational fixtures are excluded from training.

Features: sums and absolute differences of 256-bit radius-2 RDKit Morgan fingerprints, 512 total. Pair order is commutative. Unique unordered-pair split is 60/20/20, seed 42. The selected model includes its scaler, and validation permutation importance is saved. A separate whole-drug holdout audit measures harder generalization. The task predicts severity conditional on interaction; no verified negative non-interaction examples exist in this export. Scores are uncalibrated and there is no clinical validation.

EDA plot, test metrics, per-class reports, confusion matrices, split keys and model artifact are saved in `artifacts/`. Package snapshots capture local versions. Fingerprint importance is statistical, not a causal explanation.
