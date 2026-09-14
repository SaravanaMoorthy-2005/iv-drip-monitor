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
test('read notification is independent from clinical acknowledgement',()=>{let s=init();const a=s.alerts[0];s=reducer(s,{type:'read',id:'all',now});assert.equal(s.notifications.filter(n=>!n.read).length,0);assert.equal(s.alerts[0].acknowledged,false);s=reducer(s,{type:'ack',id:a.id,now});assert.equal(s.alerts[0].acknowledged,true);assert.equal(s.alerts[0].resolved,false);assert.equal(s.events.at(-1).nurse,'Nurse Priya');});
test('notes and handover preserve active alerts',()=>{let s=init();const count=s.alerts.filter(a=>!a.resolved).length;s=reducer(s,{type:'note',id:'P012',text:'Patient checked',now});assert.equal(s.events.at(-1).kind,'note');s=reducer(s,{type:'handover',text:'Continue monitoring Bed 12.',now});s=reducer(s,{type:'complete',now});assert.match(s.handover.previous,/Continue monitoring/);assert.equal(s.alerts.filter(a=>!a.resolved).length,count);assert.equal(s.events.at(-1).kind,'handover');});
test('reminders and escalation are opt-in with configured intervals',()=>{let s=init();s=reducer(s,{type:'tick',now:now+61000});assert.equal(s.notifications.some(n=>n.message.startsWith('Reminder')),false);s=reducer(s,{type:'prefs',value:{reminders:true,criticalInterval:1,escalation:true,escalationInterval:2},now});s=reducer(s,{type:'tick',now:now+121000});assert.equal(s.notifications.some(n=>n.message.startsWith('Reminder')),true);assert.equal(s.notifications.filter(n=>n.message.startsWith('Escalation')).length,1);s=reducer(s,{type:'tick',now:now+122000});assert.equal(s.notifications.filter(n=>n.message.startsWith('Escalation')).length,1);});
test('source switch isolates live and simulated data',()=>{let s=init();s=reducer(s,{type:'mode',mode:'live',now});assert.equal(s.mode,'live');assert.equal(s.patients.length,0);assert.equal(s.alerts.length,0);assert.equal(s.notifications.length,0);assert.deepEqual(s.history,{});});
test('assignment is role-gated and auto logout uses the configured timeout',()=>{let s=init();s=reducer(s,{type:'assign',id:'P001',nurse:'Nurse Ananya',now});assert.equal(s.patients[0].patient.nurse,'Nurse Priya');s=reducer(s,{type:'login',role:'Supervisor',now});s=reducer(s,{type:'assign',id:'P001',nurse:'Nurse Ananya',now});assert.equal(s.patients[0].patient.nurse,'Nurse Ananya');s=reducer(s,{type:'prefs',value:{timeout:1},now});s=reducer(s,{type:'tick',now:now+61000});assert.equal(s.session,false);});
test('reset and recovery keep prior episodes in history',()=>{let s=init();s=reducer(s,{type:'scenario',id:'P001',name:'Low bottle',now:now+1});const id=s.alerts.find(a=>a.patientId==='P001').id;s=reducer(s,{type:'scenario',id:'P001',name:'Normal patient',now:now+2});assert.equal(s.alerts.find(a=>a.id===id).resolved,true);s=reducer(s,{type:'reset',now:now+3});assert.equal(s.patients.length,12);assert.ok(s.alerts.find(a=>a.id===id));});
