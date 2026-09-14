'use client';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Switch} from '@/components/ui/switch';
import {type Status} from '@/lib/tissense/engine';
export function Pick({value,onChange,options,label}:{value:string;onChange:(v:string)=>void;options:string[];label:string}){return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="pick"><SelectValue/></SelectTrigger><SelectContent>{options.map(o=><SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>;}
export function Badge({status}:{status:Status}){return <span className={`status ${status}`}><span>{status==='normal'?'✓':status==='offline'?'×':'!'}</span>{status.charAt(0).toUpperCase()+status.slice(1)}</span>;}
export function Toggle({label,checked,onChange,hint}:{label:string;checked:boolean;onChange:(v:boolean)=>void;hint?:string}){return <div className="toggle-row"><span><strong>{label}</strong>{hint&&<small>{hint}</small>}</span><Switch aria-label={label} checked={checked} onCheckedChange={onChange}/></div>;}
export const time=(n:number)=>n>0?new Date(n).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—';
export const age=(at:number,now:number)=>{const secs=Math.max(0,Math.floor((now-at)/1000));return secs<5?'just now':secs<60?`${secs} sec ago`:secs<3600?`${Math.floor(secs/60)} min ago`:`${Math.floor(secs/3600)} hr ago`;};
export function Empty({title,description}:{title:string;description:string}){return <div className="empty-state"><span className="empty-icon">✓</span><h3>{title}</h3><p>{description}</p></div>;}

