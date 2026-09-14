import {normalizePayload,seedPatients,type Patient} from './engine';
export type DataListener=(patients:Patient[])=>void;
export interface SensorDataProvider{connect(onData:DataListener,onStatus:(message:string)=>void):()=>void;}
export class SimulationDataProvider implements SensorDataProvider{connect(onData:DataListener,onStatus:(m:string)=>void){onData(seedPatients());onStatus('Simulated sensor data');return()=>{};}}
export class WebSocketProvider implements SensorDataProvider{
 constructor(private url:string){}
 connect(onData:DataListener,onStatus:(m:string)=>void){let stopped=false,ws:WebSocket|undefined,retry:ReturnType<typeof setTimeout>|undefined;const open=()=>{if(stopped)return;onStatus('Connecting to Node-RED…');try{ws=new WebSocket(this.url);ws.onopen=()=>onStatus('Node-RED connected');ws.onmessage=e=>{try{const raw=JSON.parse(e.data);const ps=Array.isArray(raw)?raw:raw.patients??[raw];onData(ps.map((p:any)=>normalizePayload(p)));}catch{onStatus('Sensor payload rejected: invalid JSON or patient information.');}};ws.onerror=()=>onStatus('Unable to receive live monitoring data.');ws.onclose=()=>{onStatus('Node-RED disconnected. Retrying connection…');if(!stopped)retry=setTimeout(open,5000);};}catch{onStatus('Invalid WebSocket configuration.');}};open();return()=>{stopped=true;clearTimeout(retry);ws?.close();};}
}
export class RESTProvider implements SensorDataProvider{
 constructor(private url:string,private interval=3000){}
 connect(onData:DataListener,onStatus:(m:string)=>void){let stopped=false;const ac=new AbortController();let timer:ReturnType<typeof setTimeout>;const poll=async()=>{try{const response=await fetch(this.url,{signal:ac.signal,cache:'no-store'});if(!response.ok)throw new Error('HTTP '+response.status);const raw:any=await response.json();const ps=Array.isArray(raw)?raw:raw.patients??[raw];onData(ps.map((p:any)=>normalizePayload(p)));onStatus('Node-RED connected');}catch{if(!stopped)onStatus('REST connection interrupted. Retrying connection…');}finally{if(!stopped)timer=setTimeout(poll,this.interval);}};poll();return()=>{stopped=true;ac.abort();clearTimeout(timer);};}
}
export class NodeRedProvider implements SensorDataProvider{constructor(private provider:SensorDataProvider){}connect(onData:DataListener,onStatus:(m:string)=>void){return this.provider.connect(onData,onStatus);}}
// MQTT is deliberately bridged by Node-RED, not connected over raw TCP in a browser.
export class MQTTBridgeProvider extends WebSocketProvider{}
export const integrationConfig={websocket:process.env.NEXT_PUBLIC_NODE_RED_WS_URL??'',rest:process.env.NEXT_PUBLIC_NODE_RED_REST_URL??''};
