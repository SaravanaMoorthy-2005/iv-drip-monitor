'use client';
import {useState,useEffect} from 'react';
import {toast} from 'sonner';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {canSimulateRecovery,recoveryValues,type Alert,type Patient} from '@/lib/tissense/engine';
import {getCareRecommendation} from '@/lib/tissense/care-assistant';
import {Pick} from './ui';
export function CareActionDialog({open,setOpen,alertId,s,d}:any){
 const [action,setAction]=useState('Select action');
 const [note,setNote]=useState('');
 const alert:Alert|undefined=s.alerts.find((a:Alert)=>a.id===alertId);
 const patient:Patient|undefined=s.patients.find((p:Patient)=>p.patient.id===alert?.patientId);
 useEffect(()=>{if(open&&alert&&patient){setAction(getCareRecommendation(alert,patient,s.now).action);setNote('');}},[open,alertId]);
 const active=!!alert&&!alert.resolved&&alert.acknowledged&&s.session;
 const ready=active&&action!=='Select action'&&(action!=='Custom action'||!!note.trim());
 const demoReady=s.mode==='simulation'&&patient&&alert&&canSimulateRecovery(patient,alert,s.now);
 const save=(recover:boolean)=>{
  if(!ready||(recover&&!demoReady))return;
  d({type:'care',id:alertId,action,note,recover});
  setOpen(false);setAction('Select action');setNote('');
  toast.success(recover?'Action saved · simulated readings recovered':'Action saved · awaiting sensor recovery',{
   description:recover?'Cleared conditions move to history. Other warnings remain active.':'The alert stays under monitoring until valid readings return within limits.'
  });
 };
 return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="tissense-modal">
  <DialogHeader><DialogTitle>Record nurse action</DialogTitle><DialogDescription>Bed {alert?.bed} · {alert?.message}. Record what was done; action completion and sensor recovery are tracked separately.</DialogDescription></DialogHeader>
  {!active?<p className="info-banner">This alert is already resolved or needs acknowledgement first. Close this dialog to see its current status.</p>:<>
   <label className="field-label">Action taken</label>
   <Pick label="Action taken" value={action} onChange={setAction} options={[...new Set([action,'Select action','Patient checked','IV bottle replaced','IV site inspected','Doctor informed','Device repositioned','Monitoring continues','Custom action'])]}/>
   <textarea aria-label="Action details" placeholder="Optional observations; required for a custom action." value={note} maxLength={1000} onChange={e=>setNote(e.target.value)}/>
   {s.mode==='simulation'&&<div className="care-demo-box">
    <b>DEMO RECOVERY · Complete this alert</b>
    <p>{alert&&recoveryValues[alert.key]?recoveryValues[alert.key]:'Use the demo studio to restore connectivity or provide valid sensor data.'}</p>
    <p>This explicitly changes simulated readings. Unrelated sensors and other patients stay unchanged.</p>
    {!demoReady&&alert&&recoveryValues[alert.key]&&<p>Fresh, valid connected sensor data is required. Restore the device or resume simulation first.</p>}
    <button className="primary-button full-button" disabled={!ready||!demoReady} onClick={()=>save(true)}>Complete action & recover demo</button>
   </div>}
   <button className={s.mode==='live'?'primary-button':'secondary-button'} disabled={!ready} onClick={()=>save(false)}>{s.mode==='live'?'Record completed action · await device confirmation':'Record action only · await readings'}</button>
   {s.mode==='live'&&<p className="small-text muted">Live alerts resolve only after the device sends valid recovered readings. Recording an action never changes live sensor values.</p>}
  </>}
 </DialogContent></Dialog>;
}
