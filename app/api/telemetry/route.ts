import {json} from '@/lib/tissense/server';
export async function POST(){return json({error:'Real-device ingestion is disabled on the public sample application.'},403);}
