'use client';
import {useEffect,useState} from 'react';
import {Database,ShieldCheck} from 'lucide-react';
export function DatabasePanel(){
 const [health,setHealth]=useState<any>(null),[error,setError]=useState('');
 useEffect(()=>{let stopped=false;fetch('/api/health',{cache:'no-store'}).then(async response=>{if(!response.ok)throw new Error('Unable to verify backend status.');const data=await response.json();if(!stopped)setHealth(data);}).catch(e=>{if(!stopped)setError(e.message);});return()=>{stopped=true;};},[]);
 return <section className="panel database-panel"><div className="section-heading"><h2><Database size={20}/> Connected application</h2><span className={`status ${error?'warning':'normal'}`}><ShieldCheck size={14}/>{error?'Connection needs attention':health?'Database connected':'Checking connection'}</span></div><p>Your sample patients, alerts, actions and handovers are saved to PostgreSQL. Other visitors have separate workspaces.</p><div className="database-service-grid"><div><small>Frontend</small><b>TISSENSE · Next.js</b></div><div><small>Backend</small><b>{health?.backend??'Checking...'}</b></div><div><small>PostgreSQL database</small><b>{health?.database??'Checking...'}</b></div></div>{error&&<p role="alert" className="form-error">{error}</p>}<p className="small-text muted">This public application uses fictional sample data. Real-device ingestion is disabled. Do not enter real patient information.</p></section>;
}
