'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {initial,type State} from './state-core';
export {reducer} from './state-core';
export type {State,Sample,Preferences} from './state-core';

type Envelope={state:State;version:number;savedAt:number};
export function useMonitoring(){
 const [state,setState]=useState<State>(initial),[syncStatus,setSyncStatus]=useState('Connecting to database');
 const current=useRef(initial),version=useRef(0),source=useRef<'simulation'|'live'>('simulation');
 const chain=useRef(Promise.resolve()),stopped=useRef(false),lastActivity=useRef(Date.now());
 const apply=useCallback((data:Envelope)=>{if(stopped.current)return;version.current=data.version;current.current={...data.state,storageError:undefined};setState(current.current);setSyncStatus('Saved to database');},[]);
 const request=useCallback(async(action?:any)=>{
  setSyncStatus(action?'Saving action...':'Syncing monitoring');
  try{
   const response=await fetch('/api/monitoring'+(action?'':'?source='+source.current),{method:action?'POST':'GET',cache:'no-store',headers:action?{'Content-Type':'application/json'}:undefined,body:action?JSON.stringify({source:source.current,version:version.current,action}):undefined});
   const data=await response.json() as Envelope & {error?:string};
   if(response.status===401){setState({...initial,ready:true,session:false});setSyncStatus('Sign in required');return false;}
   if(!response.ok){if(response.status===409){const latest=await fetch('/api/monitoring?source='+source.current,{cache:'no-store'});if(latest.ok)apply(await latest.json() as Envelope);}throw new Error(data.error||'Monitoring request failed.');}
   apply(data);return true;
  }catch(error){if(!stopped.current){const message=error instanceof Error?error.message:'Server connection lost.';setState(s=>({...s,ready:true,storageError:message+' Changes are not saved until the server confirms them.'}));setSyncStatus('Connection needs attention');}return false;}
 },[apply]);
 const dispatch=useCallback((action:any):Promise<boolean>=>{
  lastActivity.current=Date.now();
  if(action.type==='logout'){window.location.href='/signout-with-chatgpt?return_to=%2F';return Promise.resolve(true);}
  if(action.type==='login'){window.location.href='/signin-with-chatgpt?return_to=%2F';return Promise.resolve(true);}
  if(action.type==='activity')return Promise.resolve(true);
  let result:Promise<boolean>;
  if(action.type==='mode'){
   result=chain.current.then(async()=>{source.current=action.mode==='live'?'live':'simulation';localStorage.setItem('tissense.source',source.current);return request();});
  }else result=chain.current.then(()=>request(action));
  chain.current=result.then(()=>{});return result;
 },[request]);
 const retry=useCallback(()=>{chain.current=chain.current.then(async()=>{await request();});},[request]);
 useEffect(()=>{
  stopped.current=false;source.current=localStorage.getItem('tissense.source')==='live'?'live':'simulation';
  retry();let polling=false;
  const timer=setInterval(()=>{if(polling||document.hidden)return;polling=true;chain.current=chain.current.then(async()=>{await request();}).finally(()=>{polling=false;});},3000);
  const clock=setInterval(()=>{setState(s=>s.ready?{...s,now:Date.now()}:s);if(current.current.ready&&Date.now()-lastActivity.current>current.current.prefs.timeout*60000){window.location.href='/signout-with-chatgpt?return_to=%2F';}},1000);
  const active=()=>{lastActivity.current=Date.now();};window.addEventListener('pointerdown',active);window.addEventListener('keydown',active);
  return()=>{stopped.current=true;clearInterval(timer);clearInterval(clock);window.removeEventListener('pointerdown',active);window.removeEventListener('keydown',active);};
 },[request,retry]);
 return {state,dispatch,syncStatus,retry};
}
