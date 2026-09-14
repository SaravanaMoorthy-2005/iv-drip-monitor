import {freshness, getBottleStatus, getPressureStatus, getIVSiteStatus, type Patient, type Status} from './engine';

export type EquipmentSensor = {id:string; label:string; value:string; status:Status; module:1|2; reading:number|boolean|null; description:string; threshold:string};

// A visual projection of patient telemetry. Never creates readings or changes alerts.
export function equipmentModel(p:Patient, now:number) {
  const one=freshness(p,1,now),two=freshness(p,2,now);
  const read=(value:number|boolean|null,module:1|2,field:string)=>
    (module===1?one:two)==='current'&&!p.invalid.includes(field)?value:null;
  const bottle=read(p.esp32_1.bottle_level,1,'Bottle level') as number|null;
  const rate=read(p.esp32_1.drop_rate,1,'Drop rate') as number|null;
  const count=read(p.esp32_1.drop_count,1,'Drop count') as number|null;
  const pressure=read(p.esp32_1.pressure,1,'Pressure') as number|null;
  const air=read(p.esp32_1.air_bubble,1,'Air bubble') as boolean|null;
  const moisture=read(p.esp32_2.moisture,2,'Moisture') as number|null;
  const strain=read(p.esp32_2.strain,2,'Strain') as number|null;
  const site=getIVSiteStatus(moisture,strain);
  const pct=(n:number|null)=>n===null?'Unavailable':`${n}%`;
  const sensors:EquipmentSensor[]=[
    {id:'bottle',label:'Bottle level',value:pct(bottle),status:getBottleStatus(bottle),module:1,reading:bottle,threshold:'Low bottle: ≤ 15%',description:'The filled portion follows the bottle-level reading. A low reading turns the bottle and level sensor amber.'},
    {id:'rate',label:'Drop rate',value:rate===null?'Unavailable':`${rate} drops/min`,status:rate===null?'offline':'normal',module:1,reading:rate,threshold:'Received drop rate · no configured warning threshold',description:'Each animated drop repeats at the received drops-per-minute rate. Motion illustrates the recent 60-second rate; it is not an additional measured drop event.'},
    {id:'count',label:'Total drops',value:count===null?'Unavailable':`${count} drops`,status:count===null?'offline':'normal',module:1,reading:count,threshold:'Cumulative count from the monitoring data',description:'The drop detector reports the cumulative count. Animation never increases this value; only incoming or simulated drop events do.'},
    {id:'pressure',label:'Tube pressure',value:pct(pressure),status:getPressureStatus(pressure),module:1,reading:pressure,threshold:'High pressure: > 85%',description:'The pressure sensor gauge fills to the current reading. High pressure highlights the tubing amber; this does not assume that flow has stopped.'},
    {id:'air',label:'Air detector',value:air===null?'Unavailable':air?'Detected':'Not detected',status:air===null?'offline':air?'warning':'normal',module:1,reading:air,threshold:'Warning whenever air is detected',description:'An outlined bubble appears at the air detector when detection is active. Its position is schematic; the sensor does not report bubble size or location along the line.'},
    {id:'moisture',label:'Site moisture',value:pct(moisture),status:moisture===null?'offline':site==='critical'?'critical':moisture>=50?'warning':'normal',module:2,reading:moisture,threshold:'Warning: ≥ 50% · combined critical: moisture ≥ 70% and strain ≥ 60%',description:'The moisture patch fills with the sensor reading. Amber signals elevated moisture; red signals the combined IV-site warning.'},
    {id:'strain',label:'Site strain',value:pct(strain),status:strain===null?'offline':site==='critical'?'critical':strain>=50?'warning':'normal',module:2,reading:strain,threshold:'Warning: ≥ 50% · combined critical: moisture ≥ 70% and strain ≥ 60%',description:'The strain gauge extends with the sensor reading. This is a sensor-level diagram, not a measurement of swelling or a diagnosis.'},
  ];
  const moduleOne:Status=sensors.slice(0,5).some(s=>s.status==='warning')?'warning':sensors.slice(0,5).some(s=>s.status==='offline')?'offline':'normal';
  const moduleTwo:Status=two==='current'?site:'offline';
  return {sensors,bottle,rate,count,pressure,air,moisture,strain,site,moduleOne,one,two,
    // Unknown, delayed and zero-rate telemetry must never look like active flow.
    flowing:rate!==null&&rate>0,dropSeconds:rate!==null&&rate>0?60/rate:0,
    moduleTwo};
}
