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
      const store=await client.query<any>("select default_location_id from stores where id=$1",[storeId]);
      const locationId=body?.locationId||store.rows[0]?.default_location_id||null;
      let after:number;
      if(locationId){
        let level=await client.query<any>("select * from inventory_levels where location_id=$1 and variant_id=$2 for update",[locationId,variantId]);
        if(!level.rowCount){
          if(delta<0) throw new BadRequestException("Inventory cannot be negative");
          level=await client.query<any>("insert into inventory_levels(store_id,location_id,variant_id,available) values($1,$2,$3,0) returning *",[storeId,locationId,variantId]);
        }
        const next=Number(level.rows[0].available)+delta;
        if(next<0) throw new BadRequestException("Inventory cannot be negative");
        await client.query("update inventory_levels set available=$1,updated_at=now() where id=$2",[next,level.rows[0].id]);
        const total=await client.query<any>("select coalesce(sum(available),0)::int as total from inventory_levels where variant_id=$1",[variantId]);
        after=Number(total.rows[0]?.total||0);
      }else{
        after=before+delta;
        if(after<0) throw new BadRequestException("Inventory cannot be negative");
      }
      await client.query("update product_variants set inventory=$1,updated_at=now() where id=$2",[after,variantId]);
      await client.query("insert into inventory_movements(store_id,variant_id,movement_type,quantity_delta,quantity_before,quantity_after,reason,actor) values($1,$2,'manual_adjustment',$3,$4,$5,$6,$7)",[storeId,variantId,delta,before,after,String(body?.reason||"Manual adjustment"),String(body?.actor||"admin")]);
      return {variantId,locationId,before,after,delta};
    });
  }

  async movements(variantId:string){
    const storeId=await this.storeId();
    const result=await this.db.query<any>("select im.* from inventory_movements im where im.store_id=$1 and im.variant_id=$2 order by im.created_at desc limit 250",[storeId,variantId]);
    return {items:result.rows};
  }
}
