import {initial,reducer,type State} from './state-core';
import type {Patient} from './engine';
export type Identity={userId:string;displayName:string};
type Source='simulation'|'live';
type Row={id:string;payload:string;version:number};
type RecordRow={kind:string;id:string;payload:string;patient_id:string;at:number};
export class ConflictError extends Error{}
export function workspaceId(owner:string,source:Source){return `${owner}:${source}`;}
const collections=['alerts','events','notifications'] as const;
function snapshot(state:State){const {alerts,events,notifications,history,...rest}=state;return JSON.stringify(rest);}
export async function loadState(db:D1Database,identity:Identity,source:Source){
 const id=workspaceId(identity.userId,source),now=Date.now();
 const empty={...initial,mode:source,ready:true,auto:source==='simulation',connection:source==='live'?'Waiting for authenticated device packets':'Sample sensors active',user:identity.displayName,role:'Administrator',now,lastActivity:now};
 await db.prepare('INSERT INTO monitoring_workspaces (id,owner_id,source,payload,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,identity.userId,source,snapshot(empty),now).run();
 const results=await db.batch([
  db.prepare('SELECT id,payload,version FROM monitoring_workspaces WHERE id=? AND owner_id=?').bind(id,identity.userId),
  db.prepare("SELECT * FROM monitoring_records WHERE workspace_id=? AND kind='alerts' AND json_extract(payload,'$.resolved')=0").bind(id),
  db.prepare("SELECT * FROM monitoring_records WHERE workspace_id=? AND kind='alerts' AND json_extract(payload,'$.resolved')=1 ORDER BY at DESC LIMIT 2000").bind(id),
  db.prepare("SELECT * FROM monitoring_records WHERE workspace_id=? AND kind='events' ORDER BY at DESC LIMIT 3000").bind(id),
  db.prepare("SELECT * FROM monitoring_records WHERE workspace_id=? AND kind='notifications' ORDER BY at DESC LIMIT 3000").bind(id),
  db.prepare("SELECT * FROM monitoring_records WHERE workspace_id=? AND kind='samples' AND at>=? ORDER BY at").bind(id,now-12*3600000),
 ]);
 const row=results[0].results[0] as Row;
 if(!row)throw new Error('Workspace unavailable');
 const records=results.slice(1).flatMap(r=>r.results) as RecordRow[];
 const state:State={...JSON.parse(row.payload),alerts:[],events:[],notifications:[],history:{},ready:true,session:true,user:identity.displayName,role:'Administrator',lastActivity:now};
 for(const r of records){const value=JSON.parse(r.payload);if(r.kind==='samples'){(state.history[r.patient_id]??=[]).push(value);}else if(collections.includes(r.kind as any)){(state as any)[r.kind].push(value);}}
 state.events.sort((a,b)=>a.at-b.at);state.notifications.sort((a,b)=>a.at-b.at);
 return {state,version:row.version,id};
}
export async function saveState(db:D1Database,loaded:Awaited<ReturnType<typeof loadState>>,next:State){
 const token=crypto.randomUUID(),version=loaded.version+1,now=Date.now();
 const statements=[db.prepare('UPDATE monitoring_workspaces SET payload=?,version=?,write_token=?,updated_at=? WHERE id=? AND version=?').bind(snapshot(next),version,token,now,loaded.id,loaded.version)];
 const upsert=(kind:string,id:string,payload:any,at:number,patientId='')=>statements.push(db.prepare(`INSERT INTO monitoring_records (workspace_id,kind,id,patient_id,payload,at)
  SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM monitoring_workspaces WHERE id=? AND write_token=?)
  ON CONFLICT(workspace_id,kind,id) DO UPDATE SET payload=excluded.payload,at=excluded.at,patient_id=excluded.patient_id`).bind(loaded.id,kind,id,patientId,JSON.stringify(payload),at,loaded.id,token));
 for(const kind of collections){const old=new Map(loaded.state[kind].map(x=>[x.id,JSON.stringify(x)]));for(const item of next[kind]){if(old.get(item.id)!==JSON.stringify(item))upsert(kind,item.id,item,'at' in item?item.at:item.createdAt,item.patientId);}}
 // Persist one trend sample per minute; alerts and actions are written immediately.
 const persistedHistory={...next.history};
 for(const [patientId,history] of Object.entries(next.history)){const sample=history.at(-1),last=loaded.state.history[patientId]?.at(-1);if(sample&&(!last||sample.at-last.at>=60000))upsert('samples',`${patientId}:${sample.at}`,sample,sample.at,patientId);else persistedHistory[patientId]=loaded.state.history[patientId]??[];}
 const result=await db.batch(statements);
 if(result[0].meta.changes!==1)throw new ConflictError('Readings changed. Review the latest patient state and try again.');
 return {state:{...next,history:persistedHistory},version,id:loaded.id};
}
export async function refreshState(db:D1Database,identity:Identity,source:Source){
 for(let attempt=0;attempt<3;attempt++){
  const loaded=await loadState(db,identity,source);const now=Date.now();
  let next=loaded.state;
  if(source==='simulation'&&loaded.version===0)next={...reducer(initial,{type:'init',now}),user:identity.displayName,role:'Administrator'};
  else if(now-loaded.state.now>=2500)next=reducer(loaded.state,{type:'tick',now});
  if(next===loaded.state)return loaded;
  try{return await saveState(db,loaded,next);}catch(error){if(!(error instanceof ConflictError)||attempt===2)throw error;}
 }
 throw new ConflictError('Workspace is busy. Try again.');
}
export async function receiveTelemetry(db:D1Database,identity:Identity,patients:Patient[]){
 for(let attempt=0;attempt<3;attempt++){
  const loaded=await loadState(db,identity,'live');
  for(const incoming of patients){const old=loaded.state.patients.find(p=>p.patient.id===incoming.patient.id);if(old&&(incoming.esp32_1.last_received<old.esp32_1.last_received||incoming.esp32_2.last_received<old.esp32_2.last_received))throw new ConflictError('An older sensor packet cannot replace newer readings.');}
  const next=reducer(loaded.state,{type:'packet',patients,now:Date.now()});
  next.connection='Telemetry received through secure API';
  try{return await saveState(db,loaded,next);}catch(error){if(!(error instanceof ConflictError)||attempt===2)throw error;}
 }
 throw new ConflictError('Workspace is busy. Try again.');
}
