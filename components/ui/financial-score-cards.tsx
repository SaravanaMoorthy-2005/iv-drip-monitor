'use client';
import {useId,type ReactNode} from 'react';
import {LiquidCard} from './liquid-glass-card';
import {LiquidButton} from './liquid-glass-button';

type Tone='normal'|'warning'|'critical'|'offline';
const palette:Record<Tone,[string,string]>={normal:['#91e2c5','#1c9c80'],warning:['#f9d989','#cc851d'],critical:['#fba5b3','#d54e6a'],offline:['#cad5df','#8b9baa']};
// The supplied score-card silhouette, bound to measured values instead of random scores.
export function SensorGauge({value,max=100,unit='%',status='normal',label,compact=false}:{value:number|null;max?:number;unit?:string;status?:Tone;label:string;compact?:boolean}){
 const id=useId();const available=value!==null&&Number.isFinite(value);const fraction=available?Math.max(0,Math.min(1,value/max)):0;
 const stops=palette[available?status:'offline'];
 return <div className={`sensor-gauge ${compact?'compact-gauge':''}`} role="img" aria-label={`${label}: ${available?`${value} ${unit}`:'Unavailable'}`}>
  <svg viewBox="0 0 200 112" aria-hidden="true"><defs><linearGradient id={id}><stop stopColor={stops[0]}/><stop offset="1" stopColor={stops[1]}/></linearGradient></defs><path className="gauge-track" d="M16 96 A84 84 0 0 1 184 96" fill="none" strokeWidth="14" strokeLinecap="round"/><path className="gauge-value" d="M16 96 A84 84 0 0 1 184 96" fill="none" stroke={`url(#${id})`} strokeWidth="14" strokeLinecap={fraction>0?'round':'butt'} pathLength="100" strokeDasharray={`${fraction*100} 100`}/></svg>
  <div className="gauge-number"><strong>{available?value:'—'}<small>{available?unit:''}</small></strong><span>{label}</span></div>
 </div>;
}
export type MonitoringScoreCardProps={title:string;value:number|null;unit?:string;status:Tone;description:string;children?:ReactNode;onDetails?:()=>void};
export function MonitoringScoreCard({title,value,unit='%',status,description,children,onDetails}:MonitoringScoreCardProps){return <LiquidCard className={`monitoring-score-card ${status}`}><div className="score-card-header"><h3>{title}</h3><span className={`score-status ${status}`}>{status==='offline'?'Unavailable':status==='normal'?'Normal':status==='critical'?'Critical':'Warning'}</span></div><SensorGauge value={value} unit={unit} status={status} label={title}/><p>{description}</p>{children}{onDetails&&<LiquidButton onClick={onDetails}>View monitoring</LiquidButton>}</LiquidCard>;}
export function FinancialScoreCards({items}:{items:MonitoringScoreCardProps[]}){return <div className="monitoring-score-grid">{items.map(item=><MonitoringScoreCard key={item.title} {...item}/>)}</div>;}
