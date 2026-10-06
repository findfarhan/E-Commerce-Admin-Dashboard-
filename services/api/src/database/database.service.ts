import {Injectable,OnModuleDestroy} from "@nestjs/common";
import {Pool,PoolClient,QueryResultRow} from "pg";

@Injectable()
export class DatabaseService implements OnModuleDestroy{
  private readonly pool:Pool|null;

  constructor(){
    const connectionString=process.env.DATABASE_URL;
    this.pool=connectionString?new Pool({
      connectionString,
      max:Number(process.env.DB_POOL_MAX||5),
      idleTimeoutMillis:30_000,
      connectionTimeoutMillis:10_000,
      ssl:process.env.DB_SSL==="false"?false:{rejectUnauthorized:false},
    }):null;
  }

  isConfigured(){return Boolean(this.pool);}

  async query<T extends QueryResultRow=any>(text:string,params:any[]=[]){
    if(!this.pool) throw new Error("DATABASE_URL is not configured");
    return this.pool.query<T>(text,params);
  }

  async transaction<T>(fn:(client:PoolClient)=>Promise<T>):Promise<T>{
    if(!this.pool) throw new Error("DATABASE_URL is not configured");
    const client=await this.pool.connect();
    try{
      await client.query("begin");
      const value=await fn(client);
      await client.query("commit");
      return value;
    }catch(error){
      await client.query("rollback");
      throw error;
    }finally{
      client.release();
    }
  }

  async ping(){
    if(!this.pool) return {configured:false,ok:false};
    const started=Date.now();
    await this.pool.query("select 1");
    return {configured:true,ok:true,latencyMs:Date.now()-started};
  }

  async onModuleDestroy(){await this.pool?.end();}
}
