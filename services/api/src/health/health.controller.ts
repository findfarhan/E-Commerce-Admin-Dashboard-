import {Controller,Get} from "@nestjs/common";
import {DatabaseService} from "../database/database.service";

@Controller()
export class HealthController{
  constructor(private readonly db:DatabaseService){}

  @Get("health")
  async health(){
    let database:any;
    try{
      database=await this.db.ping();
    }catch(error){
      database={
        configured:this.db.isConfigured(),
        ok:false,
        error:error instanceof Error?error.message:"Database error",
      };
    }

    const r2Configured=Boolean(
      process.env.CLOUDFLARE_ACCOUNT_ID
      &&process.env.R2_BUCKET_NAME
      &&process.env.R2_ACCESS_KEY_ID
      &&process.env.R2_SECRET_ACCESS_KEY
    );

    return {
      ok:database.ok===true,
      service:"jewelry-commerce-api",
      runtime:"NestJS + Fastify",
      version:"0.2.0",
      database,
      media:{
        provider:process.env.MEDIA_STORAGE_PROVIDER||"cloudflare-r2",
        r2Configured,
        publicDeliveryConfigured:Boolean(process.env.R2_PUBLIC_BASE_URL),
        cloudflareImageResizing:Boolean(process.env.CLOUDFLARE_IMAGE_RESIZING_BASE_URL),
      },
      now:new Date().toISOString(),
    };
  }
}
