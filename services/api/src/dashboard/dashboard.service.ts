import {Injectable,NotFoundException} from "@nestjs/common";
import {DatabaseService} from "../database/database.service";

@Injectable()
export class DashboardService{
  constructor(private readonly db:DatabaseService){}

  async summary(){
    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    const store=await this.db.query<any>("select id,name,domain,currency,timezone from stores where domain=$1 limit 1",[domain]);
    if(!store.rowCount) throw new NotFoundException("Store is not configured");
    const storeId=store.rows[0].id;

    const result=await this.db.query<any>(
      "select (select count(*)::int from products where store_id=$1 and status='active') as products,(select count(*)::int from customers where store_id=$1) as customers,(select count(*)::int from orders where store_id=$1 and created_at>=date_trunc('day',now())) as orders_today,(select coalesce(sum(total),0) from orders where store_id=$1 and payment_status='paid' and created_at>=date_trunc('day',now())) as revenue_today,(select count(*)::int from jobs where store_id=$1 and status='queued') as queued_jobs,(select count(*)::int from product_variants v join products p on p.id=v.product_id where p.store_id=$1 and v.inventory<=3 and v.status='active') as low_stock_variants,(select count(*)::int from custom_commission_requests where store_id=$1 and status='new') as new_commissions,(select count(*)::int from newsletter_subscribers where store_id=$1 and status='subscribed') as subscribers,(select count(*)::int from checkout_sessions where store_id=$1 and status='open' and expires_at>now()) as open_checkouts",
      [storeId]
    );

    const activity=await this.db.query<any>(
      "select * from (select 'order'::text as kind,oe.event_type as event_type,oe.message as message,oe.created_at as created_at from order_events oe join orders o on o.id=oe.order_id where o.store_id=$1 union all select 'commission'::text as kind,'commission.'||ccr.status as event_type,ccr.name||' · '||left(ccr.notes,120) as message,ccr.created_at as created_at from custom_commission_requests ccr where ccr.store_id=$1) activity order by created_at desc limit 8",
      [storeId]
    );

    return {...store.rows[0],...result.rows[0],recent_activity:activity.rows};
  }
}
