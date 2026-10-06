import {Injectable,NotFoundException} from "@nestjs/common";
import {DatabaseService} from "../database/database.service";

@Injectable()
export class OrdersService{
  constructor(private readonly db:DatabaseService){}

  private async storeId(){
    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    const result=await this.db.query<{id:string}>("select id from stores where domain=$1 limit 1",[domain]);
    if(!result.rowCount) throw new NotFoundException("Store is not configured");
    return result.rows[0].id;
  }

  async list(){
    const storeId=await this.storeId();
    const result=await this.db.query<any>(`
      select
        o.id,
        o.order_number,
        o.status,
        o.payment_status,
        o.currency,
        o.subtotal,
        o.total,
        o.source_channel,
        o.created_at,
        c.id as customer_id,
        c.name as customer_name,
        c.email as customer_email
      from orders o
      left join customers c on c.id=o.customer_id
      where o.store_id=$1
      order by o.created_at desc
      limit 250
    `,[storeId]);
    return {items:result.rows};
  }

  async detail(id:string){
    const storeId=await this.storeId();
    const result=await this.db.query<any>(`
      select
        o.*,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone
      from orders o
      left join customers c on c.id=o.customer_id
      where o.store_id=$1 and o.id=$2
      limit 1
    `,[storeId,id]);
    if(!result.rowCount) throw new NotFoundException("Order not found");
    return result.rows[0];
  }
}
