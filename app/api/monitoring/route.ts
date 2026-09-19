import {actionBody,sourceSchema} from '@/lib/tissense/api-validation';
import {loadState,saveState,refreshState,ConflictError} from '@/lib/tissense/repository';
import {reducer} from '@/lib/tissense/state-core';
import {database,identity,json,jsonBody,sameOrigin,apiError,HttpError} from '@/lib/tissense/server';
export async function GET(request:Request){try{const user=await identity();const source=sourceSchema.safeParse(new URL(request.url).searchParams.get('source')??'simulation');if(!source.success)throw new HttpError(400,'Invalid data source.');if(source.data!=='simulation')throw new HttpError(403,'Public workspaces support sample data only.');const result=await refreshState(database(),user,source.data);return json({state:result.state,version:result.version,savedAt:result.state.now});}catch(error){return apiError(error);}}
export async function POST(request:Request){try{
 sameOrigin(request);const user=await identity();const parsed=actionBody.safeParse(await jsonBody(request));
 if(!parsed.success)throw new HttpError(400,'Invalid monitoring action. Check the entered values.');
 const {source,version,action}=parsed.data;if(source!=='simulation')throw new HttpError(403,'Public workspaces support sample data only.');const db=database();const loaded=await loadState(db,user,source);
 if(loaded.version!==version)throw new ConflictError('Monitoring changed in another request. Review the refreshed readings and try again.');
 if(['scenario','sensor','drop','auto','reset'].includes(action.type)&&source!=='simulation')throw new HttpError(403,'Simulation controls cannot change live readings.');
 if('id' in action&&['care','assist','ack'].includes(action.type)&&!loaded.state.alerts.some(a=>a.id===action.id))throw new HttpError(404,'Alert not found.');
 if('id' in action&&['note','assign','sensor','scenario','drop'].includes(action.type)&&!loaded.state.patients.some(p=>p.patient.id===action.id))throw new HttpError(404,'Patient not found.');
 if(action.type==='care'&&action.action==='Custom action'&&!action.note?.trim())throw new HttpError(400,'Add a note for the custom action.');
 const next=reducer(loaded.state,{...action,now:Date.now()});
 if(next===loaded.state&&['care','assist'].includes(action.type))throw new ConflictError('This alert changed or recovery is unavailable. Review current readings before taking action.');
 const result=next===loaded.state?loaded:await saveState(db,loaded,next);
 return json({state:result.state,version:result.version,savedAt:Date.now()});
 }catch(error){return apiError(error);}}
