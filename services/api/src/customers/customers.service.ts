import {Injectable,NotFoundException} from "@nestjs/common";
import {DatabaseService} from "../database/database.service";

@Injectable()
export class CustomersService{
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
        c.id,
        c.name,
        c.email,
        c.phone,
        c.attributes,
        c.created_at,
        count(o.id)::int as orders_count,
        coalesce(sum(case when o.payment_status='paid' then o.total else 0 end),0) as lifetime_value,
        max(o.created_at) as last_order_at
      from customers c
      left join orders o on o.customer_id=c.id and o.store_id=c.store_id
      where c.store_id=$1
      group by c.id
      order by coalesce(max(o.created_at),c.created_at) desc
      limit 500
    `,[storeId]);
    return {items:result.rows};
  }

  async detail(id:string){
    const storeId=await this.storeId();
    const customer=await this.db.query<any>("select * from customers where store_id=$1 and id=$2 limit 1",[storeId,id]);
    if(!customer.rowCount) throw new NotFoundException("Customer not found");
    const orders=await this.db.query<any>("select * from orders where store_id=$1 and customer_id=$2 order by created_at desc",[storeId,id]);
    return {customer:customer.rows[0],orders:orders.rows};
  }
}
