import dotenv from 'dotenv';
import {fileURLToPath} from 'node:url';
dotenv.config({path:fileURLToPath(new URL('../../.env',import.meta.url))});
export const mongoUri=process.env.MONGODB_URI||'mongodb://127.0.0.1:27017/drug_alert';
export const aiUrl=process.env.AI_SERVICE_URL||'http://127.0.0.1:8000';
export async function aiRequest(path,body){const response=await fetch(aiUrl+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Internal-Secret':process.env.AI_INTERNAL_SECRET||''},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});if(!response.ok)throw new Error('AI service unavailable');return response.json();}
