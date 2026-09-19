import {identity,json,sameOrigin,apiError,HttpError} from '@/lib/tissense/server';
export async function GET(){try{await identity();return json({configured:false,enabled:false});}catch(error){return apiError(error);}}
export async function POST(request:Request){try{sameOrigin(request);await identity();throw new HttpError(403,'Device keys require a separately authenticated staff deployment. Public visitors can use sample data only.');}catch(error){return apiError(error);}}
