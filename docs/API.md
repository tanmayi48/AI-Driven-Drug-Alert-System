# REST API

All routes use `/api`. Except health, registration and login, send `Authorization: Bearer <JWT>`. JSON bodies. Validation errors return 400, missing auth 401, inaccessible records 404.

| Method | Route | Body / result |
|---|---|---|
| GET | /health | API and database status |
| POST | /auth/register | `{name,email,password}` → token, user |
| POST | /auth/login | `{email,password}` → token, user |
| GET | /drugs/search?q=aspirin | Up to 30 generic/brand matches |
| GET | /drugs/:id | Drug profile and known interactions |
| GET/POST | /patients | List / create `{name,age,sex,allergies:[],conditions:[],history}` |
| GET/POST | /prescriptions | List / create `{patientId,medications:[{drugId,doseMg,frequency,durationDays}]}` |
| POST | /prescriptions/:id/analyze | `{}` → alerts, coverage, unassessed pairs |
| POST | /ai/ddi-predict | `{drugA:canonicalId,drugB:canonicalId}` → model output or unavailable |
| GET | /alerts/:id | Stored prescription analysis |
| GET | /reports/:id | PDF attachment; requires analysis |
| POST | /chat | `{question,prescriptionId?}` → answer, sources, mode, disclaimer |
| GET | /dashboard/summary | Owner-scoped counts and latest prescriptions |
| GET | /model-info | Actual model/dataset metrics |

Mongoose schemas: `backend/src/models.js`. No user-supplied ownership fields are accepted. AI internal endpoints `/model-info`, `/ddi-predict`, `/chat` require `X-Internal-Secret` and bind locally. LLM credentials never go to the browser.
