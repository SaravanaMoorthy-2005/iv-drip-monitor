import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const cache=globalThis as typeof globalThis & {tissenseLocalPostgres?:Promise<PGlite>};
export async function localDatabase(){
 if(process.env.VERCEL||process.env.NODE_ENV==='production')throw new Error('Local test database is disabled in production.');
 return cache.tissenseLocalPostgres??= (async()=>{
  const db=new PGlite(path.resolve('.test-runtime/local-postgres'));
  await db.exec(await readFile(path.resolve('db/migrations/001_postgres.sql'),'utf8'));
  return db;
 })();
}
