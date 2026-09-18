import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {ConflictError} from './repository';
export class HttpError extends Error{constructor(public status:number,message:string){super(message);}}
export function database(){if(!env.DB)throw new HttpError(503,'Database connection is unavailable.');return env.DB;}
export async function identity(){const user=await getChatGPTUser();if(!user)throw new HttpError(401,'Sign in to access your monitoring workspace.');return {userId:user.userId,displayName:user.fullName??user.displayName};}
export function sameOrigin(request:Request){if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')throw new HttpError(403,'This action must originate from your TISSENSE application.');}
export async function jsonBody(request:Request,max=65536){if(!request.headers.get('content-type')?.includes('application/json'))throw new HttpError(415,'JSON content is required.');const raw=await request.text();if(raw.length>max)throw new HttpError(413,'Request is too large.');try{return JSON.parse(raw);}catch{throw new HttpError(400,'Invalid JSON.');}}
export const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export function apiError(error:unknown){if(error instanceof HttpError)return json({error:error.message},error.status);if(error instanceof ConflictError)return json({error:error.message},409);console.error('Monitoring API failure',error instanceof Error?error.message:'Unknown error');return json({error:'The server could not save or load monitoring data. Please retry.'},503);}
export async function tokenHash(token:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');}
