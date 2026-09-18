import fs from 'node:fs/promises';
import ts from 'typescript';
import assert from 'node:assert/strict';
import test from 'node:test';
await fs.mkdir('.test-runtime',{recursive:true});
for(const [name,extension] of [['engine','ts'],['providers','ts'],['state-core','ts'],['equipment','ts'],['care-assistant','ts']]){
 const src=await fs.readFile(`lib/tissense/${name}.${extension}`,'utf8');
 const code=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replaceAll("'./engine'","'./engine.mjs'").replaceAll("'./providers'","'./providers.mjs'");
 await fs.writeFile(`.test-runtime/${name}.mjs`,code.replaceAll("'./care-assistant'","'./care-assistant.mjs'"));
}
const {reducer}=await import('../.test-runtime/state-core.mjs');
const now=Date.now();
const init=()=>reducer(undefined,{type:'init',now});
const {patientCareState,getCareRecommendation}=await import('../.test-runtime/care-assistant.mjs');
test('one click recovers critical and linked site alerts, updates priority and retires old notifications',()=>{
 const before=init(),critical=before.alerts.find(a=>a.key==='critical');
 const after=reducer(before,{type:'assist',id:critical.id,recover:true,now});
 const p=after.patients.find(p=>p.patient.id===critical.patientId),care=patientCareState(p,after.alerts,now);
 assert.equal(care.status,'normal');assert.equal(care.active.length,0);assert.equal(care.label,'Recovery confirmed');
 for(const a of after.alerts.filter(a=>a.patientId===p.patient.id)){assert.equal(a.resolved,true);assert.equal(a.actions.length,1);assert.equal(a.actions[0].assisted,true);}
 assert.ok(after.notifications.filter(n=>n.patientId===p.patient.id&&n.group!=='Resolved').every(n=>n.read));
 assert.ok(before.notifications.filter(n=>n.patientId===p.patient.id).every(n=>!n.read));
 assert.deepEqual(after.patients.filter(x=>x.patient.id!==p.patient.id),before.patients.filter(x=>x.patient.id!==p.patient.id));
 assert.equal(reducer(after,{type:'assist',id:critical.id,recover:true,now}),after);
 const reopened=reducer(undefined,{type:'init',saved:JSON.parse(JSON.stringify(after)),now:now+10000});
 assert.equal(patientCareState(reopened.patients.find(x=>x.patient.id===p.patient.id),reopened.alerts,now+10000).status,'normal');
});
test('combined assessment puts linked episodes under monitoring without hiding critical telemetry',()=>{
 let s=init();const a=s.alerts.find(x=>x.key==='critical');
 s=reducer(s,{type:'ack',id:a.id,now});s=reducer(s,{type:'care',id:a.id,action:'IV site inspected',now});
 const care=patientCareState(s.patients.find(p=>p.patient.id===a.patientId),s.alerts,now);
 assert.equal(care.status,'critical');assert.equal(care.pending.length,0);assert.equal(care.awaiting,true);assert.equal(care.active.length,3);
});
test('recommendations cannot recover live, stale, invalid or signed-out data',()=>{
 const s=init(),a=s.alerts.find(x=>x.key==='critical');
 for(const blocked of [{...s,mode:'live'},{...s,session:false},{...s,patients:s.patients.map(p=>({...p,esp32_2:{...p.esp32_2,last_received:now-16000}}))},{...s,patients:s.patients.map(p=>({...p,invalid:['Moisture']}))}]){
  assert.equal(reducer(blocked,{type:'assist',id:a.id,recover:true,now}),blocked);
 }
 const p=s.patients.find(p=>p.patient.id===a.patientId);assert.ok(getCareRecommendation(a,p,now).steps.length>0);
});
test('critical is the leading condition and unrelated bottle warnings survive site recovery',()=>{
 let s=init();const a=s.alerts.find(x=>x.key==='critical'),id=a.patientId;
 s=reducer(s,{type:'sensor',id,module:'esp32_1',key:'bottle_level',value:10,now});
 let care=patientCareState(s.patients.find(p=>p.patient.id===id),s.alerts,now);assert.equal(care.primary.key,'critical');
 s=reducer(s,{type:'assist',id:a.id,recover:true,now});care=patientCareState(s.patients.find(p=>p.patient.id===id),s.alerts,now);
 assert.equal(care.status,'warning');assert.equal(care.primary.key,'bottle');assert.equal(care.pending.length,1);
 const bottle=care.primary;s=reducer(s,{type:'assist',id:bottle.id,recover:true,now});assert.equal(patientCareState(s.patients.find(p=>p.patient.id===id),s.alerts,now).status,'normal');
});
const {equipmentModel}=await import('../.test-runtime/equipment.mjs');
test('equipment visuals track patient scenarios without mutating readings or other patients',()=>{
 const start=init(),original=structuredClone(start.patients);
 for(const [scenario,id,value] of [['Low bottle','bottle',12],['High pressure','pressure',90],['Air bubble','air',true],['Critical IV-site warning','moisture',75]]){
  const next=reducer(start,{type:'scenario',id:start.patients[0].patient.id,name:scenario,now});
  const model=equipmentModel(next.patients[0],now);
  assert.equal(model.sensors.find(x=>x.id===id).reading,value);
  assert.equal(model.sensors.find(x=>x.id===id).status,scenario==='Critical IV-site warning'?'critical':'warning');
  assert.deepEqual(next.patients.slice(1),original.slice(1));
 }
 assert.deepEqual(start.patients,original);
});
test('equipment never animates unknown, stale or zero-rate flow and gates modules independently',()=>{
 const p=init().patients[0];
 assert.equal(equipmentModel(p,now).dropSeconds,60/p.esp32_1.drop_rate);
 for(const rate of [0,null]){const q=structuredClone(p);q.esp32_1.drop_rate=rate;assert.equal(equipmentModel(q,now).flowing,false);}
 const stale=structuredClone(p);stale.esp32_1.last_received=now-16000;
 const model=equipmentModel(stale,now);assert.equal(model.flowing,false);assert.equal(model.bottle,null);assert.equal(model.moisture,p.esp32_2.moisture);
 const invalid=structuredClone(p);invalid.invalid=['Drop rate'];assert.equal(equipmentModel(invalid,now).flowing,false);
 const offline=reducer(init(),{type:'scenario',id:p.patient.id,name:'Node-RED disconnected',now});
 assert.ok(equipmentModel(offline.patients[0],now).sensors.every(x=>x.status==='offline'));
});
test('equipment warnings follow exact thresholds and reflect nurse recovery',()=>{
 let state=init();const alert=state.alerts.find(x=>x.key==='bottle');
 state=reducer(state,{type:'ack',id:alert.id,now});state=reducer(state,{type:'care',id:alert.id,action:'IV bottle replaced',recover:true,now});
 assert.equal(equipmentModel(state.patients.find(x=>x.patient.id===alert.patientId),now).bottle,75);
 const p=structuredClone(state.patients[0]);p.esp32_1.bottle_level=15;p.esp32_1.pressure=85;p.esp32_2.moisture=70;p.esp32_2.strain=59;
 let model=equipmentModel(p,now);assert.equal(model.sensors[0].status,'warning');assert.equal(model.sensors[3].status,'normal');assert.equal(model.site,'warning');
 p.esp32_2.strain=60;assert.equal(equipmentModel(p,now).site,'critical');
});
test('queued older snapshots cannot overwrite a completed nurse action',()=>{
 const older=init();const a=older.alerts.find(x=>x.key==='bottle');
 let current=reducer(older,{type:'ack',id:a.id,now});
 current=reducer(current,{type:'care',id:a.id,action:'IV bottle replaced',recover:true,now});
 assert.equal(reducer(current,{type:'sync',saved:older,now}),current);
 assert.equal(reducer(older,{type:'sync',saved:current,now}).alerts.find(x=>x.id===a.id).resolved,true);
});
test('saved care and recovery survive reopening without spurious offline alerts',()=>{
 let s=init();const a=s.alerts.find(x=>x.key==='bottle');
 s=reducer(s,{type:'ack',id:a.id,now});s=reducer(s,{type:'care',id:a.id,action:'IV bottle replaced',recover:true,now});
 const saved=JSON.parse(JSON.stringify(s));
 const reopened=reducer(undefined,{type:'init',saved,now:now+120000});
 assert.equal(reopened.alerts.find(x=>x.id===a.id).resolved,true);
 assert.equal(reopened.alerts.find(x=>x.id===a.id).actions[0].action,'IV bottle replaced');
 assert.equal(reopened.alerts.filter(x=>!x.resolved&&x.severity==='offline').length,0);
 assert.equal(reopened.revision,s.revision);
});
test('nurse action is documented without clearing an active condition',()=>{
 let s=init();const a=s.alerts.find(a=>a.key==='bottle');
 s=reducer(s,{type:'ack',id:a.id,now});
 s=reducer(s,{type:'care',id:a.id,action:'IV bottle replaced',note:'Checked patient',recover:false,now});
 const episode=s.alerts.find(x=>x.id===a.id);
 assert.equal(episode.resolved,false);assert.equal(episode.actions[0].nurse,'Nurse Priya');
 assert.equal(episode.actions[0].note,'Checked patient');assert.equal(s.patients.find(p=>p.patient.id===a.patientId).esp32_1.bottle_level,14);
});
test('explicit demo recovery closes only the affected condition and retains its action',()=>{
 let s=init();const a=s.alerts.find(a=>a.key==='bottle');
 s=reducer(s,{type:'sensor',id:a.patientId,module:'esp32_1',key:'pressure',value:90,now});
 s=reducer(s,{type:'ack',id:a.id,now});
 s=reducer(s,{type:'care',id:a.id,action:'IV bottle replaced',recover:true,now});
 assert.equal(s.alerts.find(x=>x.id===a.id).resolved,true);
 assert.equal(s.alerts.find(x=>x.id===a.id).actions[0].simulatedRecovery,true);
 assert.equal(s.alerts.find(x=>x.patientId===a.patientId&&x.key==='pressure').resolved,false);
 assert.equal(s.alerts.find(x=>x.key==='critical').resolved,false);
 assert.ok(s.notifications.some(n=>n.group==='Resolved'&&n.patientId===a.patientId));
 s=reducer(s,{type:'tick',now:now+1000});assert.equal(s.alerts.filter(x=>x.patientId===a.patientId&&x.key==='bottle').length,1);
});
test('IV-site recovery clears related episodes with shared action audit',()=>{
 let s=init();const a=s.alerts.find(a=>a.key==='critical');
 s=reducer(s,{type:'ack',id:a.id,now});
 s=reducer(s,{type:'care',id:a.id,action:'IV site inspected',recover:true,now});
 for(const alert of s.alerts.filter(x=>x.patientId===a.patientId)){assert.equal(alert.resolved,true);assert.equal(alert.actions[0].action,'IV site inspected');}
 assert.equal(s.alerts.find(x=>x.key==='bottle').resolved,false);
});
test('action does not bypass live data, missing data, or acknowledgement',()=>{
 const base=init(),a=base.alerts.find(a=>a.key==='bottle');
 assert.equal(reducer(base,{type:'care',id:a.id,action:'Patient checked',recover:true,now}),base);
 let s=reducer(base,{type:'ack',id:a.id,now});
 const live={...s,mode:'live'};assert.equal(reducer(live,{type:'care',id:a.id,action:'Patient checked',recover:true,now}),live);
 s=reducer(s,{type:'sensor',id:a.patientId,module:'esp32_1',key:'connected',value:false,now});
 assert.equal(reducer(s,{type:'care',id:a.id,action:'Patient checked',recover:true,now}),s);
});
test('live recovery resolves documented episode and recurrence requires a fresh response',()=>{
 let s=init();const a=s.alerts.find(a=>a.key==='bottle');
 s=reducer(s,{type:'ack',id:a.id,now});s={...s,mode:'live'};
 s=reducer(s,{type:'care',id:a.id,action:'IV bottle replaced',recover:false,now});
 const p=structuredClone(s.patients.find(p=>p.patient.id===a.patientId));p.esp32_1.bottle_level=80;
 s=reducer(s,{type:'packet',patients:[p],now:now+1});assert.equal(s.alerts.find(x=>x.id===a.id).resolved,true);
 p.esp32_1.bottle_level=12;s=reducer(s,{type:'packet',patients:[p],now:now+2});
 const episode=s.alerts.find(x=>x.patientId===a.patientId&&x.key==='bottle'&&!x.resolved);
 assert.notEqual(episode.id,a.id);assert.equal(episode.acknowledged,false);assert.equal(episode.actions,undefined);
});
test('read notification is independent from clinical acknowledgement',()=>{let s=init();const a=s.alerts[0];s=reducer(s,{type:'read',id:'all',now});assert.equal(s.notifications.filter(n=>!n.read).length,0);assert.equal(s.alerts[0].acknowledged,false);s=reducer(s,{type:'ack',id:a.id,now});assert.equal(s.alerts[0].acknowledged,true);assert.equal(s.alerts[0].resolved,false);assert.equal(s.events.at(-1).nurse,'Nurse Priya');});
test('notes and handover preserve active alerts',()=>{let s=init();const count=s.alerts.filter(a=>!a.resolved).length;s=reducer(s,{type:'note',id:'P012',text:'Patient checked',now});assert.equal(s.events.at(-1).kind,'note');s=reducer(s,{type:'handover',text:'Continue monitoring Bed 12.',now});s=reducer(s,{type:'complete',now});assert.match(s.handover.previous,/Continue monitoring/);assert.equal(s.alerts.filter(a=>!a.resolved).length,count);assert.equal(s.events.at(-1).kind,'handover');});
test('reminders and escalation are opt-in with configured intervals',()=>{let s=init();s=reducer(s,{type:'tick',now:now+61000});assert.equal(s.notifications.some(n=>n.message.startsWith('Reminder')),false);s=reducer(s,{type:'prefs',value:{reminders:true,criticalInterval:1,escalation:true,escalationInterval:2},now});s=reducer(s,{type:'tick',now:now+121000});assert.equal(s.notifications.some(n=>n.message.startsWith('Reminder')),true);assert.equal(s.notifications.filter(n=>n.message.startsWith('Escalation')).length,1);s=reducer(s,{type:'tick',now:now+122000});assert.equal(s.notifications.filter(n=>n.message.startsWith('Escalation')).length,1);});
test('source switch isolates live and simulated data',()=>{let s=init();s=reducer(s,{type:'mode',mode:'live',now});assert.equal(s.mode,'live');assert.equal(s.patients.length,0);assert.equal(s.alerts.length,0);assert.equal(s.notifications.length,0);assert.deepEqual(s.history,{});});
test('assignment is role-gated and auto logout uses the configured timeout',()=>{let s=init();s=reducer(s,{type:'assign',id:'P001',nurse:'Nurse Ananya',now});assert.equal(s.patients[0].patient.nurse,'Nurse Priya');s=reducer(s,{type:'login',role:'Supervisor',now});s=reducer(s,{type:'assign',id:'P001',nurse:'Nurse Ananya',now});assert.equal(s.patients[0].patient.nurse,'Nurse Ananya');s=reducer(s,{type:'prefs',value:{timeout:1},now});s=reducer(s,{type:'tick',now:now+61000});assert.equal(s.session,false);});
test('reset and recovery keep prior episodes in history',()=>{let s=init();s=reducer(s,{type:'scenario',id:'P001',name:'Low bottle',now:now+1});const id=s.alerts.find(a=>a.patientId==='P001').id;s=reducer(s,{type:'scenario',id:'P001',name:'Normal patient',now:now+2});assert.equal(s.alerts.find(a=>a.id===id).resolved,true);s=reducer(s,{type:'reset',now:now+3});assert.equal(s.patients.length,12);assert.ok(s.alerts.find(a=>a.id===id));});
