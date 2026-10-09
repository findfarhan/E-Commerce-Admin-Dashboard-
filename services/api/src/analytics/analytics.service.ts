import {BadRequestException,Injectable,NotFoundException} from "@nestjs/common";
import {DatabaseService} from "../database/database.service";
import {Interval} from "@nestjs/schedule";

type EventType="page_view"|"product_view"|"add_to_cart"|"gift_finder_opened"|"gift_finder_results"|"bundle_viewed";
const EVENTS=new Set<string>(["page_view","product_view","add_to_cart","gift_finder_opened","gift_finder_results","bundle_viewed"]);
const SOURCES=new Set(["instagram","facebook","google","direct","other"]);
const DEVICES=new Set(["desktop","mobile","tablet","unknown"]);
const uuid=(s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
@Injectable()
export class AnalyticsService{
 constructor(private readonly db:DatabaseService){}
 private async store(){
  const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
  const r=await this.db.query<{id:string}>("select id from stores where domain=$1 limit 1",[domain]);
  if(!r.rowCount)throw new NotFoundException("Store is not configured");
  return r.rows[0].id;
 }
 async record(body:any){
  // Explicit analytics permission is required. Never include IP, browser user
  // agent, free-form properties, email, phone, cookie IDs or names in the row.
  if(body?.analyticsConsent!==true)return {ok:true,recorded:false};
  const type=String(body?.type||"");
  const session=String(body?.sessionId||"");
  const event=String(body?.eventId||"");
  if(!EVENTS.has(type)||!uuid(session)||!uuid(event))throw new BadRequestException("Invalid analytics event");
  const product=body?.productHandle==null?null:String(body.productHandle);
  const pathname=body?.path==null?null:String(body.path);
  if(product&&!/^[a-z0-9-]{1,120}$/.test(product))throw new BadRequestException("Invalid product handle");
  if(pathname&&(!/^\/[a-z0-9/\-]*$/i.test(pathname)||pathname.length>160))throw new BadRequestException("Invalid page path");
  const channel=String(body?.source||"direct"),device=String(body?.device||"unknown");
  if(!SOURCES.has(channel)||!DEVICES.has(device))throw new BadRequestException("Invalid analytics category");
  const storeId=await this.store();
  // Cap per-session event creation to 300 events per day. Dedupe browser retries.
  const total=await this.db.query<{count:string}>("select count(*)::text count from analytics_events where store_id=$1 and anonymous_session_id=$2 and occurred_at>=now()-interval '1 day'",[storeId,session]);
  if(Number(total.rows[0]?.count||0)>=300)return {ok:true,recorded:false,limited:true};
  await this.db.query(
    "insert into analytics_events(store_id,event_id,anonymous_session_id,event_type,product_handle,page_path,source_channel,device_type) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(store_id,event_id) do nothing",
    [storeId,event,session,type,product,pathname,channel,device]
  );
  return {ok:true,recorded:true};
 }
 @Interval(86400000)
 async expireOldAnonymousEvents(){
  if(!this.db.isConfigured())return;
  const ready=await this.db.query<{ready:boolean}>("select to_regclass('public.analytics_events') is not null as ready");
  if(!ready.rows[0]?.ready)return;
  const storeId=await this.store();
  await this.db.query("delete from analytics_events where store_id=$1 and occurred_at<now()-interval '90 days'",[storeId]);
 }
 async overview(){
  const storeId=await this.store();
  const [events,checkout,traffic,product,device,daily,paths]=await Promise.all([
    this.db.query<any>("select event_type,count(*)::int events,count(distinct anonymous_session_id)::int sessions from analytics_events where store_id=$1 and occurred_at>=now()-interval '30 days' group by event_type",[storeId]),
    this.db.query<any>("select count(*)::int started,count(*) filter(where status='completed')::int completed,count(*) filter(where status='expired')::int expired,count(*) filter(where status='open')::int open,coalesce(sum(total) filter(where status='expired'),0) as expired_value from checkout_sessions where store_id=$1 and created_at>=now()-interval '30 days'",[storeId]),
    this.db.query<any>("select source_channel,count(distinct anonymous_session_id)::int sessions,count(*)::int events from analytics_events where store_id=$1 and occurred_at>=now()-interval '30 days' group by source_channel order by sessions desc limit 8",[storeId]),
    this.db.query<any>("select product_handle,count(*) filter(where event_type='product_view')::int views,count(*) filter(where event_type='add_to_cart')::int add_to_cart from analytics_events where store_id=$1 and occurred_at>=now()-interval '30 days' and product_handle is not null group by product_handle order by views desc limit 30",[storeId]),
    this.db.query<any>("select device_type,count(distinct anonymous_session_id)::int sessions from analytics_events where store_id=$1 and occurred_at>=now()-interval '30 days' group by device_type order by sessions desc",[storeId]),
    this.db.query<any>("select date_trunc('day',occurred_at)::date day,count(*) filter(where event_type='product_view')::int product_views,count(*) filter(where event_type='add_to_cart')::int add_to_cart from analytics_events where store_id=$1 and occurred_at>=now()-interval '30 days' group by 1 order by 1",[storeId]),
    this.db.query<any>("select count(distinct anonymous_session_id)::int sessions from analytics_events where store_id=$1 and occurred_at>=now()-interval '30 days'",[storeId]),
  ]);
  const counts=Object.fromEntries(events.rows.map((x:any)=>[x.event_type,{events:Number(x.events),sessions:Number(x.sessions)}]));
  const a=checkout.rows[0]||{};
  const started=Number(a.started||0),completed=Number(a.completed||0),expired=Number(a.expired||0);
  return {
    periodDays:30,analyticsConsentRequired:true,
    note:"Site sessions are counted only when the shopper explicitly allows anonymous analytics; checkout counts are operational server data.",
    sessions:Number(paths.rows[0]?.sessions||0),
    funnel:{trackedVisits:Number(counts.page_view?.sessions||0),productViews:Number(counts.product_view?.sessions||0),addToCart:Number(counts.add_to_cart?.sessions||0),
      checkoutStarted:started,ordersCompleted:completed,checkoutsExpired:expired,
      checkoutConversion:started?Math.round(completed/started*1000)/10:0},
    abandonedValue:Number(a.expired_value||0),
    openCheckouts:Number(a.open||0),
    eventCounts:counts,traffic:traffic.rows,products:product.rows,devices:device.rows,daily:daily.rows
  };
 }
}
