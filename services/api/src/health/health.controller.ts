import {Controller,Get} from "@nestjs/common";
import {DatabaseService} from "../database/database.service";

@Controller()
export class HealthController{
  constructor(private readonly db:DatabaseService){}

  @Get("health")
  async health(){
    let database:any;
    let commerce:any={ok:false};
    let integrity:any={ok:false};
    try{
      database=await this.db.ping();

      const schema=await this.db.query<any>(`
        select
          to_regclass('public.stores') is not null as stores,
          to_regclass('public.products') is not null as products,
          to_regclass('public.product_variants') is not null as variants,
          to_regclass('public.product_media') is not null as media,
          to_regclass('public.product_media_sets') is not null as media_sets,
          to_regclass('public.collections') is not null as collections,
          to_regclass('public.checkout_sessions') is not null as checkouts,
          to_regclass('public.orders') is not null as orders,
          to_regclass('public.order_items') is not null as order_items,
          to_regclass('public.inventory_movements') is not null as inventory_movements,
          to_regclass('public.order_events') is not null as order_events,
          to_regclass('public.customers') is not null as customers,
          to_regclass('public.custom_commission_requests') is not null as commissions,
          to_regclass('public.newsletter_subscribers') is not null as subscribers,
          to_regclass('public.seo_documents') is not null as seo_documents,
          to_regclass('public.url_redirects') is not null as redirects,
          to_regclass('public.locations') is not null as locations,
          to_regclass('public.inventory_levels') is not null as inventory_levels,
          to_regclass('public.metafield_definitions') is not null as metafield_definitions,
          to_regclass('public.resource_metafields') is not null as resource_metafields,
          to_regclass('public.draft_orders') is not null as draft_orders,
          to_regclass('public.discount_codes') is not null as discounts,
          to_regclass('public.shipping_zones') is not null as shipping_zones,
          to_regclass('public.shipping_rates') is not null as shipping_rates,
          to_regclass('public.tax_rules') is not null as tax_rules,
          to_regclass('public.payment_transactions') is not null as payment_transactions,
          to_regclass('public.returns') is not null as returns,
          to_regclass('public.suppliers') is not null as suppliers,
          to_regclass('public.purchase_orders') is not null as purchase_orders,
          to_regclass('public.audit_log') is not null as audit_log,
          to_regclass('public.notifications') is not null as notifications,
          to_regclass('public.message_outbox') is not null as message_outbox,
          to_regclass('public.admin_users') is not null as admin_users,
          exists(select 1 from information_schema.columns where table_schema='public' and table_name='checkout_sessions' and column_name='terms_accepted_at') as checkout_consent,
          exists(select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='tracking_number') as order_tracking,
          exists(select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='is_gift') as gift_orders,
          exists(select 1 from information_schema.columns where table_schema='public' and table_name='custom_commission_requests' and column_name='reference_url') as commission_reference,
          exists(select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='inclusive_tax_amount') as inclusive_tax_breakdown,
          exists(select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='exclusive_tax_amount') as exclusive_tax_breakdown
      `);

      const counts=await this.db.query<any>(`
        select
          (select count(*)::int from products where status='active') as products,
          (select count(*)::int from product_variants where status='active') as variants,
          (select count(*)::int from collections where status='active') as collections,
          (select count(*)::int from orders) as orders,
          (select count(*)::int from customers) as customers
      `);

      const issues=await this.db.query<any>(`
        select
          (select count(*)::int from product_variants where inventory<0) as negative_inventory,
          (select count(*)::int from products p where p.status='active' and not exists(select 1 from product_variants v where v.product_id=p.id and v.status='active')) as active_products_without_variants,
          (select count(*)::int from products p where p.status='active' and not exists(select 1 from product_media pm where pm.product_id=p.id)) as active_products_without_media,
          (select count(*)::int from checkout_sessions where status='completed' and completed_order_id is null) as completed_checkout_without_order,
          (select count(*)::int from inventory_levels where on_hand<0 or reserved<0) as negative_location_inventory,
          (select count(*)::int from product_variants v where exists(select 1 from inventory_levels il where il.variant_id=v.id) and v.inventory<>(select coalesce(sum(il.on_hand),0)::int from inventory_levels il where il.variant_id=v.id)) as inventory_level_mismatch,
          (select count(*)::int from orders o where abs(coalesce(o.total,0)-(coalesce(o.subtotal,0)-coalesce(o.discount_amount,0)+coalesce(o.shipping_amount,0)+coalesce(o.exclusive_tax_amount,0)))>0.01) as order_total_mismatch,
          (select count(*)::int from draft_orders d where abs(coalesce(d.total,0)-(coalesce(d.subtotal,0)-coalesce(d.discount_amount,0)+coalesce(d.shipping_amount,0)+coalesce(d.exclusive_tax_amount,0)))>0.01) as draft_total_mismatch
      `);

      const flags=schema.rows[0]||{};
      const issueCounts=issues.rows[0]||{};
      commerce={
        ok:Object.values(flags).every(Boolean),
        schema:flags,
        counts:counts.rows[0]||{},
      };
      integrity={
        ok:Object.values(issueCounts).every(value=>Number(value)===0),
        issues:issueCounts,
      };
    }catch(error){
      database={
        configured:this.db.isConfigured(),
        ok:false,
        error:error instanceof Error?error.message:"Database error",
      };
      commerce={ok:false,error:error instanceof Error?error.message:"Commerce schema error"};
      integrity={ok:false,error:error instanceof Error?error.message:"Integrity check error"};
    }

    const r2Configured=Boolean(
      process.env.CLOUDFLARE_ACCOUNT_ID
      &&process.env.R2_BUCKET_NAME
      &&process.env.R2_ACCESS_KEY_ID
      &&process.env.R2_SECRET_ACCESS_KEY
    );

    return {
      ok:database.ok===true&&commerce.ok===true&&integrity.ok===true,
      service:"jewelry-commerce-api",
      runtime:"NestJS + Fastify",
      version:"0.5.0",
      database,
      commerce,
      integrity,
      media:{
        provider:r2Configured?"cloudflare-r2":"source-url",
        r2Configured,
        sourceUrlMode:!r2Configured,
        publicDeliveryConfigured:r2Configured?Boolean(process.env.R2_PUBLIC_BASE_URL):true,
        cloudflareImageResizing:Boolean(process.env.CLOUDFLARE_IMAGE_RESIZING_BASE_URL),
      },
      now:new Date().toISOString(),
    };
  }
}
