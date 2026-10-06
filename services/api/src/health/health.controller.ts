import {Controller,Get} from "@nestjs/common";
import {DatabaseService} from "../database/database.service";

@Controller()
export class HealthController{
  constructor(private readonly db:DatabaseService){}

  @Get("health")
  async health(){
    let database:any;
    try{database=await this.db.ping();}catch(error){database={configured:this.db.isConfigured(),ok:false,error:error instanceof Error?error.message:"Database error"};}
    return {
      ok:database.ok===true,
      service:"jewelry-commerce-api",
      runtime:"NestJS + Fastify",
      version:"0.1.0",
      database,
      r2Configured:Boolean(process.env.CLOUDFLARE_ACCOUNT_ID&&process.env.R2_BUCKET_NAME&&process.env.R2_ACCESS_KEY_ID&&process.env.R2_SECRET_ACCESS_KEY),
      now:new Date().toISOString(),
    };
  }
}
