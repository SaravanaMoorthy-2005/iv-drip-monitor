import {cookies} from 'next/headers';
import {currentSession,createSession,cookieName,sessionDuration,hashToken} from '@/lib/tissense/session';
import {sameOrigin,json,apiError,database,HttpError} from '@/lib/tissense/server';
export const runtime='nodejs';
export async function POST(request:Request){try{
 sameOrigin(request);
 if(await currentSession())return json({ready:true,source:'simulation'});
 const token=await createSession(request);if(!token)throw new HttpError(429,'Too many new workspaces. Please try again later.');
 (await cookies()).set(cookieName,token,{httpOnly:true,secure:!!process.env.VERCEL||new URL(request.url).protocol==='https:',sameSite:'lax',path:'/',maxAge:sessionDuration});
 return json({ready:true,source:'simulation'},201);
 }catch(error){return apiError(error);}}
export async function DELETE(request:Request){try{
 sameOrigin(request);const jar=await cookies(),token=jar.get(cookieName)?.value;
 if(token)await database().prepare('DELETE FROM sample_sessions WHERE token_hash=?').bind(hashToken(token)).run();
 jar.delete(cookieName);return json({ended:true});
 }catch(error){return apiError(error);}}
