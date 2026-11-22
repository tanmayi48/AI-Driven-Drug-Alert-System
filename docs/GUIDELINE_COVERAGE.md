# PDF analysis and implementation coverage

The three-page PDF is a specification, not an instruction to execute unrelated actions. It requires a working academic prototype and forbids calling rules-only logic trained AI.

| Requirement | Implementation / boundary |
|---|---|
| Patient + prescriptions | Age/sex, allergies, conditions/history, multiple medicines with positive bounded dose/frequency/duration |
| Full stack | React/Vite/Tailwind, Express/JWT, MongoDB, Python/FastAPI |
| Real datasets | DDInter 2.0, SIDER 4.1, PubChem structures with provenance, cleaning and normalized IDs |
| Three models | Logistic Regression, XGBoost, MLP; validation selection and held-out test metrics |
| Leakage/imbalance | Unique unordered pairs, stratified split, training-only balancing and drug-disjoint baseline audit |
| Explanation | Validation permutation feature importance; not SHAP or clinical mechanisms |
| Known/unseen pairs | Evidence lookup; conditional severity model; explicit unassessed pairs |
| Safety | Supported exact allergies/conditions, duplicates, SIDER ADR associations and polypharmacy priority |
| PDF | Prescription, alert severity, precautions, sources, coverage, model explanation and disclaimer |
| RAG | TF-IDF vectors, FAISS retrieval and optional LLM explanation; source panel and uncertainty |
| UI | Dashboard, autocomplete, severity filters, drug profiles, chatbot and real model confusion matrices |
| Scenarios | 40 fictional scenarios plus focused unit and integration checks |

Limits relative to a stronger final submission: DDInter bulk export lacks clinical mechanism/management text; a verified comprehensive brand/composition catalog and dosage limits require additional evidence. Thirteen optional educational drug/brand fixtures are labeled. Imported drugs without class/condition annotations do not trigger unsupported rules. Age/sex/history are captured but unsupported age-based severity rules are not invented. The model cannot prove an unseen pair interacts because its dataset lacks verified negatives. No clinical validation, EHR or mobile scope.

Document these limits honestly in the report and viva.
