import {BadRequestException,Injectable,NotFoundException} from "@nestjs/common";
import {DatabaseService} from "../database/database.service";

@Injectable()
export class OperationsService{
  constructor(private readonly db:DatabaseService){}

  private async store(){
    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    const result=await this.db.query<any>("select * from stores where domain=$1 limit 1",[domain]);
    if(!result.rowCount) throw new NotFoundException("Store is not configured");
    return result.rows[0];
  }

  async analytics(){
    const store=await this.store();
    const summary=await this.db.query<any>(
      "select coalesce(sum(case when payment_status='paid' and created_at>=now()-interval '30 days' then total else 0 end),0) as revenue_30d,count(*) filter(where created_at>=now()-interval '30 days')::int as orders_30d,coalesce(avg(case when created_at>=now()-interval '30 days' then total end),0) as aov_30d,count(distinct customer_id) filter(where created_at>=now()-interval '30 days')::int as customers_30d from orders where store_id=$1",
      [store.id]
    );
    const repeat=await this.db.query<any>(
      "select count(*)::int as repeat_customers from (select customer_id from orders where store_id=$1 and customer_id is not null group by customer_id having count(*)>1) x",
      [store.id]
    );
    const known=await this.db.query<any>("select count(*)::int as count from customers where store_id=$1",[store.id]);
    const daily=await this.db.query<any>(
      "select date_trunc('day',d)::date as day,coalesce(sum(o.total) filter(where o.payment_status='paid'),0) as revenue,count(o.id)::int as orders from generate_series(current_date-interval '29 days',current_date,interval '1 day') d left join orders o on o.store_id=$1 and date_trunc('day',o.created_at)=date_trunc('day',d) group by d order by d",
      [store.id]
    );
    const checkouts=await this.db.query<any>(
      "select count(*)::int as total,count(*) filter(where status='completed')::int as completed from checkout_sessions where store_id=$1 and created_at>=now()-interval '30 days'",
      [store.id]
    );
    const s=summary.rows[0];
    const totalKnown=Number(known.rows[0]?.count||0);
    const repeatCustomers=Number(repeat.rows[0]?.repeat_customers||0);
    const checkoutTotal=Number(checkouts.rows[0]?.total||0);
    const checkoutCompleted=Number(checkouts.rows[0]?.completed||0);
    return {
      revenue30d:Number(s.revenue_30d||0),
      orders30d:Number(s.orders_30d||0),
      aov30d:Number(s.aov_30d||0),
      customers30d:Number(s.customers_30d||0),
      knownCustomers:totalKnown,
      repeatRate:totalKnown?Math.round(repeatCustomers/totalKnown*1000)/10:0,
      checkoutConversion:checkoutTotal?Math.round(checkoutCompleted/checkoutTotal*1000)/10:0,
      daily:daily.rows.map((r:any)=>({day:r.day,revenue:Number(r.revenue||0),orders:Number(r.orders||0)})),
    };
  }

  async channels(){
    const store=await this.store();
    const rows=await this.db.query<any>(
      "select sc.*,(select count(*)::int from channel_publications cp where cp.channel_id=sc.id) as publication_count,(select count(*)::int from channel_publications cp where cp.channel_id=sc.id and cp.sync_status='error') as error_count from sales_channels sc where sc.store_id=$1 order by case when sc.channel_key='storefront' then 0 else 1 end,sc.name",
      [store.id]
    );
    return {items:rows.rows};
  }

  async inbox(){
    const store=await this.store();
    const conversations=await this.db.query<any>(
      "select c.id,c.channel,c.status,c.priority,c.subject,c.created_at,cu.name as customer_name,cu.email as customer_email from conversations c left join customers cu on cu.id=c.customer_id where c.store_id=$1 order by c.created_at desc limit 100",
      [store.id]
    );
    const commissions=await this.db.query<any>(
      "select id,name,email,phone,status,notes,created_at from custom_commission_requests where store_id=$1 order by created_at desc limit 100",
      [store.id]
    );
    return {
      conversations:conversations.rows,
      commissions:commissions.rows,
      externalConnectors:{
        email:Boolean(process.env.GMAIL_CLIENT_ID||process.env.EMAIL_PROVIDER_API_KEY),
        instagram:Boolean(process.env.META_ACCESS_TOKEN),
        whatsapp:Boolean(process.env.WHATSAPP_ACCESS_TOKEN),
      },
    };
  }

  async automations(){
    const store=await this.store();
    const jobs=await this.db.query<any>(
      "select status,count(*)::int as count from jobs where store_id=$1 group by status",
      [store.id]
    );
    const openCheckouts=await this.db.query<any>("select count(*)::int as count from checkout_sessions where store_id=$1 and status='open' and expires_at>now()",[store.id]);
    const lowStock=await this.db.query<any>("select count(*)::int as count from product_variants v join products p on p.id=v.product_id where p.store_id=$1 and v.status='active' and v.inventory<=3",[store.id]);
    const byStatus=Object.fromEntries(jobs.rows.map((row:any)=>[row.status,Number(row.count)]));
    return {
      rules:[
        {key:"checkout_expiry",name:"Expire stale checkouts",status:"active",trigger:"Every 10 minutes",action:"Close open checkout sessions after expiry",scope:"internal"},
        {key:"image_jobs",name:"Media job retry",status:"active",trigger:"Queued media job",action:"Retry failed image rendition jobs up to 3 attempts",scope:"internal"},
        {key:"inventory_watch",name:"Low stock signal",status:"active",trigger:"Admin dashboard refresh",action:"Surface variants at 3 units or below",scope:"internal"},
        {key:"abandoned_checkout",name:"Abandoned checkout outreach",status:"deferred",trigger:"Checkout expires",action:"Requires email or messaging provider",scope:"external"},
      ],
      jobs:byStatus,
      openCheckouts:Number(openCheckouts.rows[0]?.count||0),
      lowStockVariants:Number(lowStock.rows[0]?.count||0),
    };
  }

  async settings(){
    const store=await this.store();
    return {
      store:{id:store.id,name:store.name,domain:store.domain,currency:store.currency,timezone:store.timezone},
      infrastructure:{
        api:"live",
        database:"live",
        media:(process.env.MEDIA_STORAGE_PROVIDER||"source-url")==="cloudflare-r2"?"configured":"source-url",
        payment:"cod",
        email:process.env.GMAIL_CLIENT_ID||process.env.EMAIL_PROVIDER_API_KEY?"configured":"not_connected",
        meta:process.env.META_ACCESS_TOKEN?"configured":"not_connected",
        whatsapp:process.env.WHATSAPP_ACCESS_TOKEN?"configured":"not_connected",
      },
    };
  }

  async updateSettings(body:any){
    const store=await this.store();
    const name=String(body?.name||store.name).trim();
    const currency=String(body?.currency||store.currency).trim().toUpperCase();
    const timezone=String(body?.timezone||store.timezone).trim();
    if(!name||currency.length!==3||!timezone) throw new BadRequestException("Invalid store settings");
    const result=await this.db.query<any>("update stores set name=$1,currency=$2,timezone=$3 where id=$4 returning id,name,domain,currency,timezone",[name,currency,timezone,store.id]);
    return result.rows[0];
  }

  async storefront(){
    const store=await this.store();
    const productCount=await this.db.query<any>("select count(*)::int as count from products where store_id=$1 and status='active'",[store.id]);
    const collectionCount=await this.db.query<any>("select count(*)::int as count from collections where store_id=$1 and status='active'",[store.id]);
    return {
      url:"https://"+store.domain,
      apiBase:process.env.PUBLIC_API_URL||"https://e-commerce-admin-dashboard-ptgs.onrender.com",
      status:"api_ready",
      products:Number(productCount.rows[0]?.count||0),
      collections:Number(collectionCount.rows[0]?.count||0),
      paymentMethods:["cod"],
      mediaProvider:(process.env.MEDIA_STORAGE_PROVIDER||"source-url")==="cloudflare-r2"?"cloudflare-r2":"source-url",
      endpoints:[
        ["GET","/v1/storefront/products","Product listing"],
        ["GET","/v1/storefront/products/:handle","Product + variants + media"],
        ["GET","/v1/storefront/collections","Collections"],
        ["GET","/v1/storefront/collections/:handle","Collection + products"],
        ["GET","/v1/storefront/search?q=","Live catalog search"],
        ["POST","/v1/storefront/checkout","Create server-priced checkout"],
        ["POST","/v1/storefront/checkout/:id/customer","Attach customer + delivery"],
        ["POST","/v1/storefront/checkout/:id/complete","Create COD order"],
        ["POST","/v1/storefront/order-lookup","Guest order lookup"],
        ["POST","/v1/storefront/commissions","Create bespoke request"],
        ["POST","/v1/storefront/newsletter","Subscribe audience"],
        ["GET","/v1/storefront/config","Store capabilities"],
      ],
    };
  }

  async seoOverview(){
    const store=await this.store();
    const counts=await this.db.query<any>(
      "select (select count(*)::int from products where store_id=$1 and status='active') as products,(select count(*)::int from collections where store_id=$1 and status='active') as collections,(select count(*)::int from seo_documents where store_id=$1) as seo_documents,(select count(*)::int from seo_documents where store_id=$1 and robots_index=true) as indexable_documents,(select count(*)::int from entity_facts where store_id=$1) as entity_facts,(select count(*)::int from entity_facts where store_id=$1 and verified=true) as verified_facts,(select count(*)::int from authority_mentions where store_id=$1) as authority_mentions,(select count(*)::int from seo_work_items where store_id=$1 and status<>'done') as open_work_items",
      [store.id]
    );
    const media=await this.db.query<any>(
      "select count(pm.id)::int as total,count(pm.id) filter(where nullif(trim(pm.alt_text),'') is not null)::int as with_alt from product_media pm join products p on p.id=pm.product_id where p.store_id=$1",
      [store.id]
    );
    const work=await this.db.query<any>(
      "select id,pillar,title,reason,priority,status,resource_type,resource_id,created_at from seo_work_items where store_id=$1 order by case priority when 'high' then 0 when 'medium' then 1 else 2 end,created_at desc limit 100",
      [store.id]
    );
    const authority=await this.db.query<any>(
      "select id,source,mention_type,url,status,quality,discovered_at from authority_mentions where store_id=$1 order by discovered_at desc limit 50",
      [store.id]
    );
    const facts=await this.db.query<any>(
      "select id,field,value,source_type,source_url,verified,updated_at from entity_facts where store_id=$1 order by verified desc,field limit 100",
      [store.id]
    );
    const c=counts.rows[0];
    const m=media.rows[0];
    const expected=Number(c.products||0)+Number(c.collections||0);
    return {
      products:Number(c.products||0),
      collections:Number(c.collections||0),
      seoDocuments:Number(c.seo_documents||0),
      indexableDocuments:Number(c.indexable_documents||0),
      coverage:expected?Math.min(100,Math.round(Number(c.seo_documents||0)/expected*100)):0,
      entityFacts:Number(c.entity_facts||0),
      verifiedFacts:Number(c.verified_facts||0),
      authorityMentions:Number(c.authority_mentions||0),
      openWorkItems:Number(c.open_work_items||0),
      mediaTotal:Number(m.total||0),
      mediaWithAlt:Number(m.with_alt||0),
      mediaAltCoverage:Number(m.total||0)?Math.round(Number(m.with_alt||0)/Number(m.total||0)*100):100,
      workItems:work.rows,
      authority:authority.rows,
      facts:facts.rows,
      technical:{
        sitemap:true,robots:true,canonicalRegistry:true,productSchema:true,collectionSeo:true,redirectRegistry:true,
      },
    };
  }

}
