import {Controller,Get} from "@nestjs/common";
import {DatabaseService} from "../database/database.service";

@Controller()
export class HealthController{
  constructor(private readonly db:DatabaseService){}

  @Get("health")
  async health(){
    let database:any;
    let commerce:any={ok:false};
    try{
      database=await this.db.ping();
      const schema=await this.db.query<any>(`
        select
          to_regclass('public.stores') is not null as stores,
          to_regclass('public.products') is not null as products,
          to_regclass('public.product_variants') is not null as variants,
          to_regclass('public.product_media_sets') is not null as media_sets,
          to_regclass('public.checkout_sessions') is not null as checkouts,
          to_regclass('public.orders') is not null as orders,
          exists(
            select 1 from information_schema.columns
            where table_schema='public' and table_name='product_media_sets' and column_name='created_at'
          ) as media_set_timestamps
      `);
      const counts=await this.db.query<any>(`
        select
          (select count(*)::int from products where status='active') as products,
          (select count(*)::int from product_variants where status='active') as variants,
          (select count(*)::int from collections where status='active') as collections
      `);
      const flags=schema.rows[0]||{};
      commerce={
        ok:Object.values(flags).every(Boolean),
        schema:flags,
        counts:counts.rows[0]||{},
      };
    }catch(error){
      database={
        configured:this.db.isConfigured(),
        ok:false,
        error:error instanceof Error?error.message:"Database error",
      };
      commerce={
        ok:false,
        error:error instanceof Error?error.message:"Commerce schema error",
      };
    }

    const r2Configured=Boolean(
      process.env.CLOUDFLARE_ACCOUNT_ID
      &&process.env.R2_BUCKET_NAME
      &&process.env.R2_ACCESS_KEY_ID
      &&process.env.R2_SECRET_ACCESS_KEY
    );
    const sourceUrlMode=!r2Configured;

    return {
      ok:database.ok===true&&commerce.ok===true,
      service:"jewelry-commerce-api",
      runtime:"NestJS + Fastify",
      version:"0.3.0",
      database,
      commerce,
      media:{
        provider:r2Configured?"cloudflare-r2":"source-url",
        r2Configured,
        sourceUrlMode,
        publicDeliveryConfigured:r2Configured?Boolean(process.env.R2_PUBLIC_BASE_URL):true,
        cloudflareImageResizing:Boolean(process.env.CLOUDFLARE_IMAGE_RESIZING_BASE_URL),
      },
      now:new Date().toISOString(),
    };
  }
}
