import {normalizePayload} from '@/lib/tissense/engine';
import {receiveTelemetry} from '@/lib/tissense/repository';
import {database,json,jsonBody,apiError,HttpError,tokenHash} from '@/lib/tissense/server';
export async function POST(request:Request){try{
 const token=request.headers.get('authorization')?.replace(/^Bearer /,'');if(!token||!/^ts_[a-f0-9]{64}$/.test(token))throw new HttpError(401,'A valid telemetry key is required.');
 const db=database(),key=await db.prepare('SELECT owner_id FROM telemetry_keys WHERE hash=?').bind(await tokenHash(token)).first<{owner_id:string}>();if(!key)throw new HttpError(401,'Invalid telemetry key.');
 const body=await jsonBody(request,256000),raw=Array.isArray(body)?body:body.patients??[body];if(!Array.isArray(raw)||raw.length<1||raw.length>50)throw new HttpError(400,'Send between 1 and 50 complete patient packets.');
 const now=Date.now();const patients=raw.map(p=>{if(!p?.patient||['id','name','bed'].some(k=>typeof p.patient[k]!=='string'||!p.patient[k].trim()||p.patient[k].length>100))throw new HttpError(400,'Valid patient ID, name and bed are required.');return normalizePayload(p,'live',now);});
 if(new Set(patients.map(p=>p.patient.id)).size!==patients.length)throw new HttpError(400,'Duplicate patient IDs in packet.');
 await receiveTelemetry(db,{userId:key.owner_id,displayName:'Device gateway'},patients);return json({accepted:patients.length,receivedAt:now},202);
 }catch(error){return apiError(error);}}
