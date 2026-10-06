import {BadRequestException,Injectable,NotFoundException} from "@nestjs/common";
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
    const result=await this.db.query<any>("select c.id,c.name,c.email,c.phone,c.attributes,c.created_at,count(o.id)::int as orders_count,coalesce(sum(case when o.payment_status='paid' then o.total else 0 end),0) as lifetime_value,max(o.created_at) as last_order_at from customers c left join orders o on o.customer_id=c.id and o.store_id=c.store_id where c.store_id=$1 group by c.id order by coalesce(max(o.created_at),c.created_at) desc limit 500",[storeId]);
    return {items:result.rows};
  }

  async detail(id:string){
    const storeId=await this.storeId();
    const customer=await this.db.query<any>("select * from customers where store_id=$1 and id=$2 limit 1",[storeId,id]);
    if(!customer.rowCount) throw new NotFoundException("Customer not found");
    const orders=await this.db.query<any>("select id,order_number,status,payment_status,fulfillment_status,total,created_at from orders where store_id=$1 and customer_id=$2 order by created_at desc",[storeId,id]);
    const notes=await this.db.query<any>("select * from customer_notes where customer_id=$1 order by created_at desc",[id]);
    return {customer:customer.rows[0],orders:orders.rows,notes:notes.rows};
  }

  async addNote(id:string,body:any){
    const storeId=await this.storeId();
    const note=String(body?.note||"").trim();
    if(!note) throw new BadRequestException("Note is required");
    const customer=await this.db.query("select id from customers where id=$1 and store_id=$2",[id,storeId]);
    if(!customer.rowCount) throw new NotFoundException("Customer not found");
    const author=String(body?.author||"admin");
    const result=await this.db.query<any>("insert into customer_notes(customer_id,note,author) values($1,$2,$3) returning *",[id,note,author]);
    await this.db.query("insert into audit_log(store_id,actor,action,resource_type,resource_id,after_state) values($1,$2,'customer.note_added','customer',$3,$4::jsonb)",[storeId,author,id,JSON.stringify({noteId:result.rows[0].id,note})]);
    return result.rows[0];
  }
}
