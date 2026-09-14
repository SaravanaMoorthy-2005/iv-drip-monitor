'use client';
import {useEffect,useReducer,useRef,useCallback} from 'react';
import {type Patient,type Alert,type Event,type Notification,seedPatients,reconcileAlerts,generateDrop,applyScenario,scenarios,freshness,simulateAlertRecovery,canSimulateRecovery,getAlertWorkflow} from './engine';
import {NodeRedProvider,WebSocketProvider,RESTProvider,integrationConfig} from './providers';
export type Sample={at:number;bottle:number|null;rate:number|null;pressure:number|null;moisture:number|null;strain:number|null};
export type Preferences={privacy:boolean;sound:boolean;vibration:boolean;criticalSound:boolean;warningSound:boolean;reminders:boolean;criticalInterval:number;warningInterval:number;escalation:boolean;escalationInterval:number;supervisor:string;timeout:number};
export type State={patients:Patient[];alerts:Alert[];events:Event[];notifications:Notification[];history:Record<string,Sample[]>;handover:{notes:string;previous:string;completedAt:number|null};mode:'simulation'|'live';auto:boolean;now:number;ready:boolean;connection:string;role:string;user:string;session:boolean;prefs:Preferences;reminded:Record<string,number>;lastActivity:number;revision?:number;storageError?:string};
const defaults:Preferences={privacy:false,sound:true,vibration:false,criticalSound:true,warningSound:true,reminders:false,criticalInterval:0,warningInterval:0,escalation:false,escalationInterval:0,supervisor:'Nurse station',timeout:30};
const initial:State={patients:[],alerts:[],events:[],notifications:[],history:{},handover:{notes:'',previous:'No previous handover recorded on this device.',completedAt:null},mode:'simulation',auto:true,now:0,ready:false,connection:'Simulated connections',role:'Nurse',user:'Nurse Priya',session:true,prefs:defaults,reminded:{},lastActivity:0};
const event=(patientId:string,message:string,kind:string,at:number,nurse?:string):Event=>({id:crypto.randomUUID(),patientId,message,kind,at,nurse});
function update(s:State,ps:Patient[],now:number):State{const alerts=reconcileAlerts(s.alerts,ps,now),events=[...s.events],notifications=[...s.notifications];for(const a of alerts){const old=s.alerts.find(b=>b.id===a.id);if(!old||(!old.resolved&&a.resolved)){const resolved=a.resolved;events.push(event(a.patientId,`${a.message} ${resolved?'resolved — sensor returned within limits':'raised'}`,resolved?'resolution':'alert',now));notifications.push({id:`${a.id}-${resolved?'resolved':'raised'}`,patientId:a.patientId,message:`Bed ${a.bed} · ${a.message}${resolved?' resolved':''}`,at:now,group:resolved?'Resolved':a.severity==='offline'?'Device / Connectivity':a.severity==='critical'?'Critical':'Warnings',read:false});}}
 const history={...s.history};for(const p of ps){const old=history[p.patient.id]??[];if(!old.length||now-old[old.length-1].at>=5000){const a=freshness(p,1,now)==='current',b=freshness(p,2,now)==='current';history[p.patient.id]=[...old,{at:now,bottle:a?p.esp32_1.bottle_level:null,rate:a?p.esp32_1.drop_rate:null,pressure:a?p.esp32_1.pressure:null,moisture:b?p.esp32_2.moisture:null,strain:b?p.esp32_2.strain:null}].filter(x=>now-x.at<=12*3600000);}}
 return {...s,patients:ps,alerts,events,notifications,history,now};}
function reduceState(s:State,a:any):State{const now=a.now??Date.now();switch(a.type){
 case 'init':{const restored=a.saved??{};const loaded=restored.patients?.length?restored.patients:seedPatients(now);const ps=loaded.map((p:Patient)=>restored.auto!==false&&p.gateway.node_red&&p.gateway.wifi?{...p,esp32_1:{...p.esp32_1,last_received:p.esp32_1.connected&&p.gateway.esp_now?now:p.esp32_1.last_received},esp32_2:{...p.esp32_2,last_received:p.esp32_2.connected?now:p.esp32_2.last_received}}:p);return update({...initial,...restored,prefs:{...defaults,...restored.prefs},ready:true,now,lastActivity:now,mode:'simulation',connection:'Simulated connections'},ps,now);}
 case 'sync':return (a.saved.revision??0)>(s.revision??0)?{...a.saved,ready:true,now,storageError:undefined}:s;
 case 'storage-error':return {...s,storageError:a.message};
 case 'tick':{if(!s.ready)return s;let ps=s.patients;if(s.mode==='simulation')ps=ps.map(p=>{let q=structuredClone(p);const a=q.esp32_1,b=q.esp32_2;if(s.auto&&q.gateway.node_red&&q.gateway.wifi){if(a.connected&&q.gateway.esp_now){a.last_received=now;if(now-(q.drops.at(-1)??0)>=3000)q=generateDrop(q,now);}if(b.connected)b.last_received=now;}q.drops=q.drops.filter(t=>now-t<60000);q.esp32_1.drop_rate=q.drops.length;return q;});let next=update(s,ps,now);const reminded={...s.reminded};for(const alert of next.alerts.filter(x=>!x.resolved&&!x.acknowledged)){const minutes=alert.severity==='critical'?s.prefs.criticalInterval:alert.severity==='warning'?s.prefs.warningInterval:0;const due=s.prefs.reminders&&minutes>0&&now-(reminded[alert.id]??alert.createdAt)>=minutes*60000;if(due){next.notifications.push({id:crypto.randomUUID(),patientId:alert.patientId,message:`Reminder · Bed ${alert.bed} · ${alert.message}`,at:now,group:alert.severity==='critical'?'Critical':'Warnings',read:false});reminded[alert.id]=now;}const key=`${alert.id}-escalated`;if(s.prefs.escalation&&s.prefs.escalationInterval>0&&alert.severity==='critical'&&!reminded[key]&&now-alert.createdAt>=s.prefs.escalationInterval*60000){next.notifications.push({id:crypto.randomUUID(),patientId:alert.patientId,message:`Escalation to ${s.prefs.supervisor} (simulated) · Bed ${alert.bed}`,at:now,group:'Critical',read:false});next.events.push(event(alert.patientId,'Escalation simulated to '+s.prefs.supervisor,'escalation',now));reminded[key]=now;}}return {...next,reminded,session:s.session&&now-s.lastActivity<s.prefs.timeout*60000};}
 case 'ack':{if(!s.session)return s;const target=s.alerts.find(x=>x.id===a.id);if(!target||target.resolved||target.acknowledged)return s;return {...s,alerts:s.alerts.map(x=>x.id===a.id?{...x,acknowledged:true,acknowledgedBy:s.user,acknowledgedAt:now}:x),events:[...s.events,event(target.patientId,`${target.message} acknowledged by ${s.user}`,'acknowledgement',now,s.user)]};}
 case 'care':{
  const target=s.alerts.find(x=>x.id===a.id);
  const patient=s.patients.find(p=>p.patient.id===target?.patientId);
  if(!s.session||!target||!patient||target.resolved||!target.acknowledged||typeof a.action!=='string'||!a.action.trim())return s;
  if(a.recover&&(s.mode!=='simulation'||!canSimulateRecovery(patient,target,now)))return s;
  const action={id:crypto.randomUUID(),action:a.action.trim().slice(0,200),note:String(a.note??'').trim().slice(0,1000),nurse:s.user,at:now,simulatedRecovery:!!a.recover};
  const recovered=a.recover?simulateAlertRecovery(patient,target,now):patient;
  // One IV-site intervention may clear related moisture/strain episodes together.
  const afterKeys=new Set(reconcileAlerts(s.alerts,[recovered],now).filter(x=>x.patientId===target.patientId&&x.resolved&&!s.alerts.find(old=>old.id===x.id)?.resolved).map(x=>x.id));
  const ids=new Set([target.id,...(a.recover?afterKeys:[])]);
  const alerts=s.alerts.map(x=>ids.has(x.id)?{...x,acknowledged:true,acknowledgedBy:x.acknowledgedBy??s.user,acknowledgedAt:x.acknowledgedAt??now,actions:[...(x.actions??[]),action]}:x);
  const events=[...s.events,event(target.patientId,`${action.action}${action.note?' — '+action.note:''} · ${target.message}${a.recover?' · simulated sensor recovery requested':' · awaiting sensor recovery'}`,'care',now,s.user)];
  return update({...s,alerts,events},s.patients.map(p=>p.patient.id===patient.patient.id?recovered:p),now);
 }
 case 'note':return a.text.trim()?{...s,events:[...s.events,event(a.id,a.text.trim(),'note',now,s.user)]}:s;
 case 'audit':return {...s,events:[...s.events,event(a.id??'',a.message,a.kind??'activity',now,s.user)]};
 case 'read':return {...s,notifications:s.notifications.map(n=>a.id==='all'||n.id===a.id?{...n,read:true}:n)};
 case 'scenario':if(s.mode!=='simulation')return s;return update({...s,events:[...s.events,event(a.id,'Demo scenario: '+a.name,'simulation',now,s.user)]},s.patients.map(p=>p.patient.id===a.id?applyScenario(p,a.name,now):p),now);
 case 'sensor':if(s.mode!=='simulation')return s;return update({...s,events:[...s.events,event(a.id,`Demo ${a.key}: ${a.value}`,'sensor',now)]},s.patients.map(p=>{if(p.patient.id!==a.id)return p;return {...p,[a.module]:{...(p as any)[a.module],[a.key]:a.value,...(a.module==='gateway'?{}:{last_received:now})}}}),now);
 case 'drop':return s.mode==='simulation'?update({...s,events:[...s.events,event(a.id,'Drop detected +1','drop',now)]},s.patients.map(p=>p.patient.id===a.id?generateDrop(p,now):p),now):s;
 case 'auto':return {...s,auto:a.value};
 case 'reset':return s.mode==='simulation'?update({...s,auto:true,events:[...s.events,event('','Simulation readings reset; history retained','simulation',now,s.user)]},seedPatients(now),now):s;
 case 'prefs':return {...s,prefs:{...s.prefs,...a.value}};
 case 'assign':if(s.role==='Nurse')return s;return {...s,patients:s.patients.map(p=>p.patient.id===a.id?{...p,patient:{...p.patient,nurse:a.nurse}}:p),events:[...s.events,event(a.id,'Assigned to '+a.nurse,'assignment',now,s.user)]};
 case 'handover':return {...s,handover:{...s.handover,notes:a.text}};
 case 'complete':return {...s,handover:{notes:'',previous:`${new Date(now).toLocaleString()} · ${s.user}\n${s.handover.notes}\nUnresolved alerts: ${s.alerts.filter(x=>!x.resolved).length}`,completedAt:now},events:[...s.events,event('','Handover completed','handover',now,s.user)]};
 case 'logout':return {...s,session:false,events:[...s.events,event('','Demo session signed out','session',now,s.user)]};
 case 'login':return {...s,session:true,role:a.role,user:a.role==='Nurse'?'Nurse Priya':a.role==='Supervisor'?'Supervisor Ananya':'Administrator',lastActivity:now,events:[...s.events,event('','Demo session signed in: '+a.role,'session',now)]};
 case 'activity':return {...s,lastActivity:now};
 case 'mode':return {...initial,ready:true,mode:a.mode,auto:a.mode==='simulation',prefs:s.prefs,role:s.role,user:s.user,lastActivity:now,now,patients:a.mode==='simulation'?seedPatients(now):[],connection:a.mode==='live'?'Connecting to live source…':'Simulated connections'};
 case 'packet':return update(s,[...s.patients.filter(p=>!a.patients.some((q:Patient)=>q.patient.id===p.patient.id)),...a.patients],now);
 case 'connection':{const failed=/disconnected|interrupted|Unable/.test(a.value);const next={...s,connection:a.value,events:s.connection===a.value?s.events:[...s.events,event('',a.value,'device',now)]};return failed?update(next,s.patients.map(p=>({...p,gateway:{...p.gateway,node_red:false}})),now):next;}
 default:return s;}}
export function reducer(s:State,a:any):State {
 const next=reduceState(s,a);
 if(next===s||['init','sync','storage-error','activity'].includes(a.type))return next;
 const changed=a.type!=='tick'||next.events.length!==s.events.length;
 return changed?{...next,revision:Math.max(a.now??Date.now(),(s?.revision??0)+1)}:next;
}
const DEMO_KEY='tissense.demo.v2';
function readDemo():State|undefined {
 try{const raw=localStorage.getItem(DEMO_KEY)??localStorage.getItem('tissense.demo.v1');
  const saved=raw?JSON.parse(raw):undefined;
  return saved?.mode==='simulation'&&Array.isArray(saved.patients)&&Array.isArray(saved.alerts)?saved:undefined;
 }catch{return undefined;}
}
export function useMonitoring(){
 const [state,rawDispatch]=useReducer(reducer,initial);
 const ref=useRef(state);ref.current=state;
 const dispatch=useCallback((action:any)=>{
  const current=ref.current;
  if(current.ready&&current.mode==='simulation'){
   const saved=readDemo();
   if(saved&&(saved.revision??0)>(current.revision??0))rawDispatch({type:'sync',saved});
  }
  rawDispatch(action);
 },[]);
 const persist=useCallback(()=>{
  const current=ref.current;
  if(!current.ready||current.mode!=='simulation')return;
  const saved=readDemo();
  // An older tab must never overwrite a newer nurse action or resolved episode.
  if(saved&&(saved.revision??0)>(current.revision??0)){rawDispatch({type:'sync',saved});return;}
  try{localStorage.setItem(DEMO_KEY,JSON.stringify({...current,events:current.events.slice(-3000),alerts:current.alerts.slice(-3000),notifications:current.notifications.slice(-3000)}));}
  catch{rawDispatch({type:'storage-error',message:'Demo changes could not be saved on this device. Keep this page open and export the history.'});}
 },[]);
 useEffect(()=>{
  rawDispatch({type:'init',saved:readDemo()});
  const clock=setInterval(()=>dispatch({type:'tick'}),1000);
  const activity=()=>{if(Date.now()-ref.current.lastActivity>10000)rawDispatch({type:'activity'});};
  const sync=(e:StorageEvent)=>{if(e.key===DEMO_KEY&&ref.current.mode==='simulation'){const saved=readDemo();if(saved&&(saved.revision??0)>(ref.current.revision??0))rawDispatch({type:'sync',saved});}};
  window.addEventListener('pointerdown',activity);window.addEventListener('keydown',activity);window.addEventListener('storage',sync);window.addEventListener('pagehide',persist);
  return()=>{clearInterval(clock);window.removeEventListener('pointerdown',activity);window.removeEventListener('keydown',activity);window.removeEventListener('storage',sync);window.removeEventListener('pagehide',persist);};
 },[persist,dispatch]);
 useEffect(()=>{persist();},[state.revision,state.ready,state.session,persist]);
 useEffect(()=>{const timer=setInterval(persist,5000);return()=>clearInterval(timer);},[persist]);
 useEffect(()=>{
  if(state.mode!=='live')return;
  const provider=integrationConfig.websocket?new WebSocketProvider(integrationConfig.websocket):integrationConfig.rest?new RESTProvider(integrationConfig.rest):null;
  if(!provider){rawDispatch({type:'connection',value:'Live integration is not configured. Set the Node-RED environment URL.'});return;}
  return new NodeRedProvider(provider).connect(patients=>rawDispatch({type:'packet',patients}),value=>rawDispatch({type:'connection',value}));
 },[state.mode]);
 return {state,dispatch};
}

