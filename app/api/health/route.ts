import {database,identity,json,apiError} from '@/lib/tissense/server';
export async function GET(){try{await identity();await database().prepare('SELECT count(*) AS count FROM monitoring_workspaces').first();return json({status:'ok',backend:'Connected',database:'Connected',authentication:'Signed in',telemetryEndpoint:'/api/telemetry'});}catch(error){return apiError(error);}}
