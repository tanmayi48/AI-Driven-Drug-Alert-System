# Executed validation — 4 October 2026

Actual executed checks:

| Check | Result |
|---|---|
| React production build | Passed; Vite 6.4.3 |
| Node safety suite | 48 passed, including 40 fictional scenarios |
| Python feature/service suite | 4 passed |
| Real preprocessing | 160 drugs, 1,513 DDInter pairs, 27,304 SIDER associations |
| Three-model training | Passed; model, metrics, splits, importance and EDA saved |
| API integration | Registration, patient/prescription persistence, known DDI, allergy, PDF, grounded chat, uncertainty, model metadata, live prediction, real DDInter/SIDER analysis, owner isolation and dashboard passed |
| Desktop browser | Registration, dashboard, patient form, two medicine cards, analysis, Explain Alerts and model page verified |
| Mobile browser | Model page at 390 × 844; no horizontal document overflow |
| Browser errors | None observed; development connection logs and React DevTools notice only |

Test macro-F1: Logistic Regression 0.6021, XGBoost 0.7778, MLP 0.6570. XGBoost selected using validation macro-F1. Train/validation/test: 907/303/303. Drug-disjoint Logistic Regression baseline: macro-F1 0.5025 with 32 held-out drugs, 1,114 training pairs and 399 test pairs. These are research evaluation results, not clinical validation.

Artifacts: `artifacts/metrics.json`, `artifacts/model.joblib`, `artifacts/splits.json`, `artifacts/eda_comparison.png`, `docs/integration-results.json`, `docs/sample-report.pdf`. Desktop/mobile screenshots are in this folder.

The LLM generation branch was not tested because OPENAI_API_KEY is intentionally empty. Retrieval, current-prescription explanation and unsupported-question uncertainty were tested. No public deployment or clinical validation was performed.

Integration exposed vocabulary suppression of current-alert evidence. Fixed by retaining authorized prescription context for explanation requests and using a larger sparse vocabulary with FAISS candidate ranking; subsequent checks passed. ADR associations are grouped by medicine, retaining the full effects list.

Re-run with all services running: `node scripts/verify_flow.mjs`. This creates clearly fictional accounts and patient records in the configured project database.


## 2026-10-12 update verification

- `npm run build`: passed.
- `npm run test -w backend`: 53 passed, including aggregated dose, unsupported dose coverage, condition aliases, pediatric limits and all three pairs after prediction failure.
- `.venv/Scripts/python.exe -m unittest discover -s tests`: 7 passed. OpenRouter requests are mocked: general questions without evidence, missing credentials and malformed provider responses.
- Live API: registration 201, login 200, duplicate registration 409 JSON, new account empty prescriptions; second account denied another account's patients, prescriptions, alerts and chat context.
- Live analysis: three medicines produced three pair checks, a High dose alert and an ibuprofen patient-risk alert for fictional age 70 / CKD.
- Browser automation attempted twice; Chromium CDP connection closed. Visual and interactive browser verification was not completed.
- OPENROUTER_API_KEY is unset. No live OpenRouter generation was tested. Restart the services after adding the key.
- Clinical rule coverage is partial: verified ceilings for paracetamol and ibuprofen only; other doses require explicit review. Missing pair evidence remains unassessed. No clinical validation is claimed.
