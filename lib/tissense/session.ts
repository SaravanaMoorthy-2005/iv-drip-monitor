import {cookies} from 'next/headers';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {getDatabase} from '@/db/postgres';
export const cookieName='tissense_sample_session';
export const sessionDuration=30*24*60*60;
export const hashToken=(token:string)=>createHash('sha256').update(token).digest('hex');
export async function currentSession(){
 const token=(await cookies()).get(cookieName)?.value;
 if(!token||!/^\w{64}$/.test(token))return null;
 const row=await getDatabase().prepare('SELECT owner_id FROM sample_sessions WHERE token_hash=? AND expires_at>?').bind(hashToken(token),Date.now()).first<{owner_id:string}>();
 return row?{userId:row.owner_id,displayName:'Sample visitor',sample:true as const}:null;
}
export async function createSession(request:Request){
 const db=getDatabase(),now=Date.now();
 const ip=process.env.VERCEL?request.headers.get('x-vercel-forwarded-for')??request.headers.get('x-forwarded-for')??'unknown':'local';
 const bucket=hashToken(ip.split(',')[0].trim()+':'+Math.floor(now/3600000));
 const limit=await db.prepare('INSERT INTO session_rate_limits(id,count,expires_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=session_rate_limits.count+1 RETURNING count').bind(bucket,now+3600000).first<{count:number}>();
 if((limit?.count??101)>100)return null;
 const token=randomBytes(32).toString('hex'),owner=randomUUID();
 await db.prepare('INSERT INTO sample_sessions(token_hash,owner_id,expires_at) VALUES (?,?,?)').bind(hashToken(token),owner,now+sessionDuration*1000).run();
 return token;
}
