import {Injectable,Logger} from "@nestjs/common";
import {Interval} from "@nestjs/schedule";
import {DatabaseService} from "../database/database.service";
import {MediaService} from "../media/media.service";

@Injectable()
export class JobsService{
  private readonly logger=new Logger(JobsService.name);
  private running=false;
  private cleaning=false;

  constructor(private readonly db:DatabaseService,private readonly media:MediaService){}

  @Interval(15000)
  async tick(){
    if(this.running||!this.db.isConfigured()) return;
    this.running=true;
    let job:any=null;
    try{
      job=await this.db.transaction(async client=>{
        const found=await client.query<any>("select * from jobs where status='queued' and available_at<=now() order by created_at for update skip locked limit 1");
        if(!found.rowCount) return null;
        const row=found.rows[0];
        await client.query("update jobs set status='running',locked_at=now(),attempts=attempts+1 where id=$1",[row.id]);
        return row;
      });
      if(!job) return;
      if(job.kind==="image.renditions.generate") await this.media.processRenditions(job.payload.mediaId);
      else throw new Error("Unsupported job kind: "+job.kind);
      await this.db.query("update jobs set status='done',locked_at=null,last_error=null where id=$1",[job.id]);
    }catch(error){
      this.logger.error(error);
      if(job){
        const message=error instanceof Error?error.message:"Job failed";
        await this.db.query("update jobs set status=case when attempts>=3 then 'failed' else 'queued' end,locked_at=null,last_error=$2,available_at=now()+interval '1 minute' where id=$1",[job.id,message.slice(0,1000)]);
      }
    }finally{
      this.running=false;
    }
  }

  @Interval(600000)
  async expireCheckouts(){
    if(this.cleaning||!this.db.isConfigured()) return;
    this.cleaning=true;
    try{
      const result=await this.db.query("update checkout_sessions set status='expired',updated_at=now() where status='open' and expires_at<now()");
      if((result.rowCount||0)>0) this.logger.log("Expired "+result.rowCount+" stale checkout session(s)");
    }catch(error){
      this.logger.error("Checkout cleanup failed: "+(error instanceof Error?error.message:String(error)));
    }finally{
      this.cleaning=false;
    }
  }
}
