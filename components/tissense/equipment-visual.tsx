'use client';
import {useId,useState,type CSSProperties} from 'react';
import {Pause,Play,Radio,FlaskConical,Info} from 'lucide-react';
import {equipmentModel} from '@/lib/tissense/equipment';
import {scenarios,type Patient} from '@/lib/tissense/engine';
import {type State} from '@/lib/tissense/store';

const colors={normal:'#28b6ad',warning:'#efa936',critical:'#f1677a',offline:'#8097aa'};
export function EquipmentVisual({patient:p,s,d}:{patient:Patient;s:State;d:(a:any)=>void}){
  const uid=useId().replaceAll(':','');
  const [selected,setSelected]=useState('bottle'),[paused,setPaused]=useState(false),[scenario,setScenario]=useState(scenarios[0]);
  const m=equipmentModel(p,s.now),item=m.sensors.find(x=>x.id===selected)!;
  const color=(id:string)=>colors[m.sensors.find(x=>x.id===id)!.status];
  const running=m.flowing;
  const statusText=(status:string,id:string)=>status==='normal'?id==='count'||id==='rate'?'Received reading':'Within limits':status==='offline'?'Data unavailable':status==='critical'?'Critical warning':'Warning';
  const marker=(id:string,n:number,x:number,y:number)=><g className={`eq-marker ${selected===id?'selected':''}`}><circle cx={x} cy={y} r="14" fill={color(id)}/><text x={x} y={y+5} textAnchor="middle">{n}</text></g>;
  return <section className={`equipment-panel ${paused?'eq-paused':''}`} aria-label="Virtual IV equipment">
    <div className="equipment-heading"><div><span className="equipment-kicker">VIRTUAL EQUIPMENT · BED {p.patient.bed}</span><h3>Your patient’s IV, visualized</h3></div><button className="secondary-button" aria-pressed={paused} onClick={()=>setPaused(!paused)}>{paused?<Play size={15}/>:<Pause size={15}/>} {paused?'Resume animation':'Pause animation'}</button></div>
    <div className="equipment-layout">
      <div className="equipment-stage" style={{'--drop-time':`${m.dropSeconds||3}s`,'--flow-time':`${Math.max(.25,m.dropSeconds||3)}s`} as CSSProperties}>
        <div className="equipment-stage-top"><span><Radio size={14}/>{s.mode==='simulation'?'Simulated telemetry':'Live telemetry'}</span><span>{paused?'Animation paused':m.rate===null?'Flow data unavailable':m.rate===0?'No drops in recent window':'Flow animation active'}</span></div>
        <svg viewBox="0 0 620 520" role="img" aria-label={`IV equipment schematic for bed ${p.patient.bed}. ${m.sensors.map(x=>`${x.label}: ${x.value}`).join('. ')}`}>
          <defs>
            <linearGradient id={`${uid}-glass`} x1="0" x2="1"><stop stopColor="#c5e9ed" stopOpacity=".30"/><stop offset=".3" stopColor="#e8fcff" stopOpacity=".08"/><stop offset=".85" stopColor="#b1dce2" stopOpacity=".19"/><stop offset="1" stopColor="#e6ffff" stopOpacity=".4"/></linearGradient>
            <linearGradient id={`${uid}-fluid`} x1="0" x2="1"><stop stopColor={color('bottle')} stopOpacity=".3"/><stop offset="1" stopColor={color('bottle')} stopOpacity=".85"/></linearGradient>
            <clipPath id={`${uid}-bottle`}><path d="M112 74 Q112 56 130 56 H222 Q240 56 240 74 V245 Q240 266 211 282 L193 294 H159 L141 282 Q112 266 112 245Z"/></clipPath>
          </defs>
          <path d="M70 480V35 Q70 18 87 18H176V42" fill="none" stroke="#587385" strokeWidth="6" strokeLinecap="round"/>
          <path d="M35 481H103" stroke="#587385" strokeWidth="6" strokeLinecap="round"/>
          <rect x="152" y="40" width="48" height="20" rx="6" fill="#a5bfcb"/>
          <path d="M112 74 Q112 56 130 56 H222 Q240 56 240 74 V245 Q240 266 211 282 L193 294 H159 L141 282 Q112 266 112 245Z" fill={`url(#${uid}-glass)`} stroke="#a1c8d3" strokeWidth="2"/>
          <g clipPath={`url(#${uid}-bottle)`}>{m.bottle!==null&&<rect className="eq-liquid" x="112" y={294-238*m.bottle/100} width="128" height={238*m.bottle/100} fill={`url(#${uid}-fluid)`}/>}<path d="M121 78V239" stroke="#e4ffff" opacity=".35" strokeWidth="5" strokeLinecap="round"/></g>
          {[0,1,2,3,4].map(i=><path key={i} d={`M219 ${91+i*34}h13`} stroke="#d5e7ed" opacity=".6"/>)}
          <text x="176" y="159" textAnchor="middle" className="eq-big-value">{m.bottle===null?'—':`${m.bottle}%`}</text><text x="176" y="181" textAnchor="middle" className="eq-label">BOTTLE LEVEL</text>
          <rect x="95" y="212" width="34" height="35" rx="7" fill="#1c394e" stroke={color('bottle')} strokeWidth="2"/>{marker('bottle',1,104,208)}
          <path d="M163 296H189V312H163Z" fill="#9ab9c7"/>
          <rect x="155" y="313" width="42" height="80" rx="17" fill={`url(#${uid}-glass)`} stroke="#a1c8d3" strokeWidth="2"/>
          <path d="M159 370H193V374Q193 389 177 389Q159 389 159 374Z" fill="#28b6ad" opacity=".45"/>
          {running&&<circle key={p.patient.id} className="eq-drip" cx="176" cy="326" r="4" fill="#a8ffef"/>}
          <path d="M146 349H206" stroke={color('rate')} strokeWidth="2" strokeDasharray="4 3"/><rect x="137" y="337" width="12" height="26" rx="4" fill="#1c394e" stroke={color('rate')}/><rect x="204" y="337" width="12" height="26" rx="4" fill="#1c394e" stroke={color('count')}/>
          {marker('rate',2,137,328)}{marker('count',3,216,373)}
          <path d="M176 393V421Q176 447 202 447H420" fill="none" stroke="#6a8799" strokeWidth="12" strokeLinecap="round"/>
          <path d="M176 393V421Q176 447 202 447H420" fill="none" stroke={m.rate===null?colors.offline:color('pressure')} strokeOpacity=".65" strokeWidth="6" strokeLinecap="round"/>
          {running&&<path className="eq-flow" d="M176 393V421Q176 447 202 447H420" fill="none" stroke="#d1fff4" strokeWidth="3" strokeDasharray="3 22"/>}
          <rect x="248" y="425" width="52" height="43" rx="10" fill="#193449" stroke={color('pressure')} strokeWidth="2"/>
          <rect x="258" y="435" width="32" height="6" rx="3" fill="#3a5261"/>{m.pressure!==null&&<rect x="258" y="435" width={32*m.pressure/100} height="6" rx="3" fill={color('pressure')}/>}{marker('pressure',4,247,420)}
          <rect x="329" y="427" width="44" height="39" rx="9" fill="#193449" stroke={color('air')} strokeWidth="2"/>
          <circle cx="351" cy="447" r={m.air?9:4} fill={m.air?'#193449':color('air')} stroke={color('air')} strokeWidth="2" className={m.air?'eq-pulse':''}/>{marker('air',5,369,420)}
          <path d="M129 229H286V133H349 M216 350H284V153H349" className="eq-wire"/>
          <rect x="348" y="95" width="204" height="93" rx="13" className="eq-board"/><text x="366" y="119" className="eq-board-title">ESP32 #1</text><text x="366" y="142" className="eq-label">BOTTLE + DRIP</text>
          <circle cx="531" cy="114" r="6" fill={colors[m.moduleOne]} className={m.moduleOne==='warning'?'eq-pulse':''}/><text x="366" y="171" className="eq-board-state">{m.one!=='current'?m.one==='delayed'?'Data delayed':'Offline':m.moduleOne==='offline'?'Check sensor data':m.moduleOne==='warning'?'Warning · buzzer on':'Normal · buzzer off'}</text>
          <path d="M450 189V229" className={`eq-wire ${m.one==='current'&&m.two==='current'?'eq-link-active':''}`}/><text x="465" y="217" className="eq-label">ESP-NOW</text>
          <rect x="348" y="230" width="204" height="93" rx="13" className="eq-board"/><text x="366" y="254" className="eq-board-title">ESP32 #2</text><text x="366" y="278" className="eq-label">IV SITE + GATEWAY</text>
          <circle cx="531" cy="249" r="6" fill={colors[m.moduleTwo]} className={m.moduleTwo==='critical'?'eq-pulse':''}/><text x="366" y="307" className="eq-board-state">{m.two!=='current'?m.two==='delayed'?'Data delayed':'Offline':m.moduleTwo==='critical'?'Critical · buzzer on':m.moduleTwo==='warning'?'Warning · buzzer on':m.moduleTwo==='offline'?'Check sensor data':'Normal · buzzer off'}</text>
          <path d="M475 324V368" className="eq-wire"/>
          <rect x="411" y="368" width="155" height="108" rx="24" fill="#233d51" stroke="#637f91"/>
          <text x="489" y="393" textAnchor="middle" className="eq-label">IV-SITE PATCH</text>
          <rect x="435" y="405" width="42" height="45" rx="7" fill="#152a3d" stroke={color('moisture')}/>{m.moisture!==null&&<rect className="eq-liquid" x="440" y={444-33*m.moisture/100} width="32" height={33*m.moisture/100} rx="3" fill={color('moisture')} opacity=".65"/>}
          <rect x="495" y="405" width="43" height="45" rx="7" fill="#152a3d" stroke={color('strain')}/><path d={`M502 428l5 -${4+(m.strain??0)*.1}l7 ${8+(m.strain??0)*.2}l7 -${8+(m.strain??0)*.2}l9 ${4+(m.strain??0)*.1}`} fill="none" stroke={color('strain')} strokeWidth="2"/>
          {marker('moisture',6,435,404)}{marker('strain',7,536,404)}
          <text x="290" y="495" textAnchor="middle" className="eq-label">FLUID LINE → IV SITE</text>
        </svg>
        <p className="equipment-caption">{paused?"Motion paused · sensor monitoring continues":"Animated schematic · readings drive the visuals · not to scale"}</p>
      </div>
      <div className="equipment-readouts" aria-label="Equipment sensor readings"><p>Select a sensor to understand it</p>{m.sensors.map((sensor,i)=><button key={sensor.id} className={`equipment-reading ${selected===sensor.id?'active':''}`} aria-pressed={selected===sensor.id} onClick={()=>setSelected(sensor.id)} style={{'--sensor-color':colors[sensor.status]} as CSSProperties}><span className="equipment-number">{i+1}</span><span><b>{sensor.label}</b><small>{statusText(sensor.status,sensor.id)}</small></span><strong>{sensor.value}</strong></button>)}</div>
    </div>
    <div className="equipment-explainer" aria-live="polite"><Info size={20}/><div><h4>{item.label} <span>ESP32 #{item.module} · {item.value}</span></h4><p>{item.reading===null?`This reading is ${freshnessLabel(item.module===1?m.one:m.two)}. Its measurement animation is disabled until current, valid data returns.`:item.description}</p><small>{item.threshold}</small></div></div>
    {s.mode==='simulation'&&<div className="equipment-scenarios"><span><FlaskConical size={17}/> Try a scenario for bed {p.patient.bed}</span><select aria-label="Equipment scenario" value={scenario} onChange={e=>setScenario(e.target.value)}>{scenarios.map(x=><option key={x}>{x}</option>)}</select><button className="primary-button" onClick={()=>d({type:'scenario',id:p.patient.id,name:scenario})}>Apply scenario</button><small>Updates this fictional patient’s readings and alerts.</small></div>}
  </section>;
}
const freshnessLabel=(f:string)=>f==='current'?'missing or invalid':f==='delayed'?'delayed':'unavailable';
