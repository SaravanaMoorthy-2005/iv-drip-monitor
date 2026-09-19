'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {initial,type State} from './state-core';
export {reducer} from './state-core';
export type {State,Sample,Preferences} from './state-core';
type Envelope={state:State;version:number;savedAt:number};
export function useMonitoring(){
 const [state,setState]=useState<State>(initial),[syncStatus,setSyncStatus]=useState('Connecting to database');
 const current=useRef(initial),version=useRef(0),chain=useRef(Promise.resolve()),stopped=useRef(false),paused=useRef(false),lastActivity=useRef(Date.now());
 const pause=useCallback(()=>{paused.current=true;current.current={...initial,ready:true,session:false};setState(current.current);setSyncStatus('Workspace paused');},[]);
 const apply=useCallback((data:Envelope)=>{if(stopped.current)return;version.current=data.version;current.current={...data.state,storageError:undefined};setState(current.current);setSyncStatus('Saved to database');},[]);
 const failure=useCallback((error:unknown)=>{if(!stopped.current){setState(s=>({...s,ready:true,session:s.ready?s.session:false,storageError:(error instanceof Error?error.message:'Server connection lost.')+' Changes are not saved until the server confirms them.'}));setSyncStatus('Connection needs attention');}},[]);
 const request=useCallback(async(action?:any)=>{
  if(paused.current)return false;
  setSyncStatus(action?'Saving action...':'Syncing monitoring');
  try{
   const response=await fetch('/api/monitoring',{method:action?'POST':'GET',cache:'no-store',headers:action?{'Content-Type':'application/json'}:undefined,body:action?JSON.stringify({source:'simulation',version:version.current,action}):undefined});
   const data=await response.json() as Envelope & {error?:string};
   if(response.status===401){pause();return false;}
   if(!response.ok){if(response.status===409){const latest=await fetch('/api/monitoring',{cache:'no-store'});if(latest.ok)apply(await latest.json() as Envelope);}throw new Error(data.error||'Monitoring request failed.');}
   apply(data);return true;
  }catch(error){failure(error);return false;}
 },[apply,failure,pause]);
 const startSession=useCallback(async()=>{
  try{const response=await fetch('/api/session',{method:'POST'});if(!response.ok){const data=await response.json() as {error?:string};throw new Error(data.error||'Unable to open sample workspace.');}paused.current=false;lastActivity.current=Date.now();return await request();}catch(error){failure(error);return false;}
 },[request,failure]);
 const dispatch=useCallback((action:any):Promise<boolean>=>{
  lastActivity.current=Date.now();if(action.type==='activity')return Promise.resolve(true);
  const result=chain.current.then(async()=>{
   if(action.type==='login')return startSession();
   if(action.type==='logout'){try{const response=await fetch('/api/session',{method:'DELETE'});if(!response.ok)throw new Error('Unable to end the session. Please retry.');pause();return true;}catch(error){failure(error);return false;}}
   if(action.type==='mode')return false;
   return request(action);
  });chain.current=result.then(()=>{});return result;
 },[request,startSession,pause,failure]);
 const retry=useCallback(()=>{chain.current=chain.current.then(async()=>{if(!current.current.ready||!current.current.session)await startSession();else await request();});},[request,startSession]);
 useEffect(()=>{
  stopped.current=false;chain.current=chain.current.then(async()=>{await startSession();});let polling=false;
  const timer=setInterval(()=>{if(polling||document.hidden||paused.current||!current.current.ready)return;polling=true;chain.current=chain.current.then(async()=>{await request();}).finally(()=>{polling=false;});},3000);
  const clock=setInterval(()=>{if(paused.current)return;setState(s=>s.ready?{...s,now:Date.now()}:s);if(current.current.ready&&Date.now()-lastActivity.current>current.current.prefs.timeout*60000)pause();},1000);
  const active=()=>{lastActivity.current=Date.now();};window.addEventListener('pointerdown',active);window.addEventListener('keydown',active);
  return()=>{stopped.current=true;clearInterval(timer);clearInterval(clock);window.removeEventListener('pointerdown',active);window.removeEventListener('keydown',active);};
 },[request,startSession,pause]);
 return {state,dispatch,syncStatus,retry};
}
