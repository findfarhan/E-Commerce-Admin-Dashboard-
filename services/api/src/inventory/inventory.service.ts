import {BadRequestException,Injectable,NotFoundException} from "@nestjs/common";
import {DatabaseService} from "../database/database.service";

@Injectable()
export class InventoryService{
  constructor(private readonly db:DatabaseService){}

  private async storeId(){
    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    const result=await this.db.query<{id:string}>("select id from stores where domain=$1 limit 1",[domain]);
    if(!result.rowCount) throw new NotFoundException("Store is not configured");
    return result.rows[0].id;
  }

  async adjust(variantId:string,body:any){
    const delta=Number(body?.delta);
    if(!Number.isInteger(delta)||delta===0||Math.abs(delta)>100000) throw new BadRequestException("A non-zero integer delta is required");
    const storeId=await this.storeId();

    return this.db.transaction(async client=>{
      const found=await client.query<any>("select v.id,v.inventory from product_variants v join products p on p.id=v.product_id where v.id=$1 and p.store_id=$2 for update",[variantId,storeId]);
      if(!found.rowCount) throw new NotFoundException("Variant not found");
      const before=Number(found.rows[0].inventory);
      const after=before+delta;
      if(after<0) throw new BadRequestException("Inventory cannot be negative");
      await client.query("update product_variants set inventory=$1,updated_at=now() where id=$2",[after,variantId]);
      await client.query("insert into inventory_movements(store_id,variant_id,movement_type,quantity_delta,quantity_before,quantity_after,reason,actor) values($1,$2,'manual_adjustment',$3,$4,$5,$6,$7)",[storeId,variantId,delta,before,after,String(body?.reason||"Manual adjustment"),String(body?.actor||"admin")]);
      await client.query("insert into audit_log(store_id,actor,action,resource_type,resource_id,before_state,after_state,metadata) values($1,$2,'inventory.adjusted','variant',$3,$4::jsonb,$5::jsonb,$6::jsonb)",[storeId,String(body?.actor||"admin"),variantId,JSON.stringify({inventory:before}),JSON.stringify({inventory:after}),JSON.stringify({delta,reason:String(body?.reason||"Manual adjustment")})]);
      if(after<=3) await client.query("insert into notifications(store_id,kind,severity,title,message,resource_type,resource_id) values($1,'low_stock','warning','Low stock',$2,'variant',$3)",[storeId,"Variant "+variantId+" has "+after+" unit(s) remaining",variantId]);
      return {variantId,before,after,delta};
    });
  }

  async movements(variantId:string){
    const storeId=await this.storeId();
    const result=await this.db.query<any>("select im.* from inventory_movements im where im.store_id=$1 and im.variant_id=$2 order by im.created_at desc limit 250",[storeId,variantId]);
    return {items:result.rows};
  }
}
