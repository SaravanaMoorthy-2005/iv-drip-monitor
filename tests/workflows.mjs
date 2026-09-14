import fs from 'node:fs/promises';
import ts from 'typescript';
import assert from 'node:assert/strict';
import test from 'node:test';
await fs.mkdir('.test-runtime',{recursive:true});
for(const [name,extension] of [['engine','ts'],['providers','ts'],['store','tsx']]){
 const src=await fs.readFile(`lib/tissense/${name}.${extension}`,'utf8');
 const code=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replaceAll("'./engine'","'./engine.mjs'").replaceAll("'./providers'","'./providers.mjs'");
 await fs.writeFile(`.test-runtime/${name}.mjs`,code);
}
const {reducer}=await import('../.test-runtime/store.mjs');
const now=Date.now();
const init=()=>reducer(undefined,{type:'init',now});
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
