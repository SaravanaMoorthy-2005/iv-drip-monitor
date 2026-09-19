import {neon} from '@neondatabase/serverless';

export type QueryResult={results:Record<string,any>[];meta:{changes:number}};
export type Executor=(queries:{sql:string;args:unknown[]}[])=>Promise<QueryResult[]>;
export class Statement {
 constructor(readonly database:Database,readonly sql:string,readonly args:unknown[]=[]){ }
 bind(...args:unknown[]){return new Statement(this.database,this.sql,args);}
 async run(){return (await this.database.batch([this]))[0];}
 async first<T=Record<string,any>>():Promise<T|null>{return ((await this.run()).results[0] as T)??null;}
}
export class Database {
 constructor(private execute:Executor){}
 prepare(sql:string){return new Statement(this,sql);}
 batch(statements:Statement[]){return this.execute(statements.map(s=>{let parameter=0;return {sql:s.sql.replace(/\?/g,()=>`$${++parameter}`),args:s.args};}));}
}
export function neonDatabase(url:string){
 const sql=neon(url,{fullResults:true});
 return new Database(async queries=>{
  const results=await sql.transaction(queries.map(q=>sql.query(q.sql,q.args)),{fullResults:true});
  return results.map(r=>({results:r.rows,meta:{changes:r.rowCount??0}}));
 });
}
let connection:Database|undefined;
export function getDatabase(){
 if(connection)return connection;
 if(process.env.TISSENSE_LOCAL_DB==='1'&&!process.env.VERCEL&&process.env.NODE_ENV!=='production'){
  connection=new Database(async queries=>{
   const {localDatabase}=await import('./local-postgres');
   return (await localDatabase()).transaction(async tx=>{
    const results:QueryResult[]=[];
    for(const q of queries){const r=await tx.query(q.sql,q.args);results.push({results:r.rows as Record<string,any>[],meta:{changes:r.affectedRows??r.rows.length}});}
    return results;
   });
  });return connection;
 }
 const url=process.env.DATABASE_URL;
 if(!url)throw new Error('DATABASE_URL is not configured. Connect the PostgreSQL database.');
 connection=neonDatabase(url);return connection;
}
