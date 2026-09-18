import {canSimulateRecovery,freshness,getOverallStatus,type Alert,type Patient} from './engine';

export const careGuidance:Record<string,{title:string;action:string;steps:string[]}>={
 bottle:{title:'Review the bottle and prescribed infusion',action:'Bottle assessment recorded',steps:['Check the patient, remaining fluid and prescribed infusion.','Follow the local replacement protocol if a bottle change is needed.','Confirm a new, valid bottle-level reading.']},
 pressure:{title:'Assess the line and pressure warning',action:'Line pressure assessment recorded',steps:['Assess the patient and inspect the tubing and insertion site.','Use the device instructions and local escalation protocol to address the cause.','Confirm pressure returns within the configured limit.']},
 air:{title:'Promptly assess the air-detection warning',action:'Air-detection assessment recorded',steps:['Check the patient and the indicated IV line promptly.','Follow the device air-alarm procedure and local clinical protocol.','Verify a fresh “not detected” reading before closing the episode.']},
 moisture:{title:'Assess the insertion site',action:'IV-site assessment recorded',steps:['Inspect the site and dressing; assess tenderness and visible changes.','Document the assessment and escalate concerns under local protocol.','Reassess the patient and verify the moisture reading.']},
 strain:{title:'Assess the site and sensor placement',action:'IV-site assessment recorded',steps:['Inspect the insertion site and check sensor placement.','Document the assessment and escalate concerns under local protocol.','Reassess the patient and verify the strain reading.']},
 critical:{title:'Prioritize an IV-site assessment',action:'Combined IV-site assessment recorded',steps:['Promptly assess the patient and insertion site; both sensor limits are exceeded.','Escalate concerns and follow the local IV-complication protocol.','Reassess both moisture and strain; record findings and confirm recovery.']},
 device1:{title:'Check the bottle-monitor connection',action:'Bottle monitor connection checked',steps:['Check power, sensor connections and the ESP-NOW link.','Restore connectivity and request a fresh packet.','Retain existing warnings until valid sensor readings return.']},
 device2:{title:'Check the site-monitor connection',action:'Site monitor connection checked',steps:['Check power, site-sensor connections and gateway status.','Restore connectivity and request a fresh packet.','Verify both IV-site readings before considering the episode recovered.']},
 node:{title:'Restore the monitoring gateway',action:'Gateway connection checked',steps:['Check the Node-RED service and Wi-Fi connection.','Restore the data path and verify fresh packets from both modules.','Assess the patient directly while telemetry is unavailable.']},
 invalid:{title:'Verify the invalid sensor fields',action:'Sensor validation review recorded',steps:['Review which sensor fields are missing or invalid.','Check the sensor and incoming data format; request valid readings.','Keep the alert open while the condition is unknown.']},
};
export function getCareRecommendation(a:Alert,p:Patient,now:number){
 const guide=careGuidance[a.key]??{title:'Review this monitoring alert',action:'Monitoring assessment recorded',steps:['Assess the patient and check the reported condition.','Follow local protocol and confirm valid updated readings.']};
 const missing=[1,2].filter(n=>freshness(p,n as 1|2,now)!=='current');
 return {...guide,evidence:`${a.parameter}: ${a.currentValue} · Limit: ${a.threshold}`,canRecover:canSimulateRecovery(p,a,now),
  recoveryBlocked:p.system.mode==='live'?'Live mode: the device must confirm recovery.':missing.length?`Fresh readings required from ESP32 ${missing.join(' and ')}.`:p.invalid.length?'Correct invalid sensor readings before simulating recovery.':'This alert requires restored connectivity or valid sensor data.'};
}
export function patientCareState(p:Patient,alerts:Alert[],now:number){
 const rank={critical:0,warning:1,offline:2,normal:3};
 const active=alerts.filter(a=>a.patientId===p.patient.id&&!a.resolved).sort((a,b)=>rank[a.severity]-rank[b.severity]);
 const pending=active.filter(a=>!a.actions?.length);
 const status=getOverallStatus(p,now);
 const recovered=alerts.filter(a=>a.patientId===p.patient.id&&a.resolved&&a.actions?.length).sort((a,b)=>(b.resolvedAt??0)-(a.resolvedAt??0))[0];
 return {active,pending,status,recovered,primary:active[0],awaiting:active.length>0&&pending.length===0,
  label:active.length?pending.length?'Needs response':'Awaiting sensor recovery':status==='normal'?recovered?'Recovery confirmed':'Within limits':'Check monitoring data'};
}
