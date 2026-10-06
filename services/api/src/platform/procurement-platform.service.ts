import {BadRequestException,ConflictException,Injectable,NotFoundException} from "@nestjs/common";
import {DatabaseService} from "../database/database.service";
import {GovernanceService} from "./governance.service";
import {StoreContextService} from "./store-context.service";

@Injectable()
export class ProcurementPlatformService{
  constructor(private readonly db:DatabaseService,private readonly context:StoreContextService,private readonly governance:GovernanceService){}

  async suppliers(){
    const storeId=await this.context.storeId();
    const result=await this.db.query<any>("select * from suppliers where store_id=$1 order by active desc,name",[storeId]);
    return {items:result.rows};
  }

  async createSupplier(body:any){
    const storeId=await this.context.storeId();
    const name=String(body?.name||"").trim();
    if(!name) throw new BadRequestException("Supplier name is required");
    const result=await this.db.query<any>(
      "insert into suppliers(store_id,name,email,phone,address,notes,active) values($1,$2,$3,$4,$5::jsonb,$6,$7) returning *",
      [storeId,name,String(body?.email||"").trim()||null,String(body?.phone||"").trim()||null,JSON.stringify(body?.address||{}),String(body?.notes||"").trim()||null,body?.active!==false]
    );
    await this.governance.audit(storeId,"supplier.created","supplier",result.rows[0].id,{after:result.rows[0]});
    return result.rows[0];
  }

  async purchaseOrders(){
    const storeId=await this.context.storeId();
    const result=await this.db.query<any>(
      `select po.*,s.name as supplier_name,l.name as location_name,
       (select count(*)::int from purchase_order_items i where i.purchase_order_id=po.id) as item_count
       from purchase_orders po left join suppliers s on s.id=po.supplier_id left join locations l on l.id=po.location_id
       where po.store_id=$1 order by po.created_at desc limit 250`,
      [storeId]
    );
    return {items:result.rows};
  }

  async purchaseOrder(id:string){
    const storeId=await this.context.storeId();
    const po=await this.db.query<any>("select po.*,s.name as supplier_name,l.name as location_name from purchase_orders po left join suppliers s on s.id=po.supplier_id left join locations l on l.id=po.location_id where po.id=$1 and po.store_id=$2",[id,storeId]);
    if(!po.rowCount) throw new NotFoundException("Purchase order not found");
    const items=await this.db.query<any>("select i.*,v.sku,p.title from purchase_order_items i join product_variants v on v.id=i.variant_id join products p on p.id=v.product_id where i.purchase_order_id=$1 order by i.id",[id]);
    return {purchaseOrder:po.rows[0],items:items.rows};
  }

  async createPurchaseOrder(body:any){
    const store=await this.context.store();
    const items=Array.isArray(body?.items)?body.items:[];
    if(!items.length) throw new BadRequestException("Purchase order needs items");
    return this.db.transaction(async client=>{
      const locationId=String(body?.locationId||store.default_location_id||"");
      const location=await client.query<any>("select id from locations where id=$1 and store_id=$2 and is_active=true",[locationId,store.id]);
      if(!location.rowCount) throw new BadRequestException("Receiving location is invalid");
      if(body?.supplierId){
        const supplier=await client.query<any>("select id from suppliers where id=$1 and store_id=$2 and active=true",[String(body.supplierId),store.id]);
        if(!supplier.rowCount) throw new BadRequestException("Supplier is invalid");
      }
      const normalized:any[]=[];
      let subtotal=0;
      for(const raw of items){
        const variantId=String(raw?.variantId||"");
        const quantity=Number(raw?.quantity);
        const unitCost=Number(raw?.unitCost);
        if(!variantId||!Number.isInteger(quantity)||quantity<1||!Number.isFinite(unitCost)||unitCost<0) throw new BadRequestException("Invalid purchase-order item");
        const variant=await client.query<any>("select v.id,v.sku from product_variants v join products p on p.id=v.product_id where v.id=$1 and p.store_id=$2",[variantId,store.id]);
        if(!variant.rowCount) throw new BadRequestException("Unknown purchase-order variant");
        const lineTotal=Math.round(quantity*unitCost*100)/100;
        subtotal+=lineTotal;
        normalized.push({variantId,quantity,unitCost,lineTotal});
      }
      const number=await client.query<{value:string}>("select 'PO-'||lpad(nextval('jewelry_purchase_order_seq')::text,6,'0') as value");
      const created=await client.query<any>(
        "insert into purchase_orders(store_id,supplier_id,location_id,po_number,status,currency,subtotal,notes,expected_at,created_by) values($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9) returning *",
        [store.id,body?.supplierId||null,locationId,number.rows[0].value,body?.currency||store.currency||"PKR",subtotal,String(body?.notes||"").trim()||null,body?.expectedAt||null,String(body?.actor||"admin")]
      );
      for(const item of normalized){
        await client.query("insert into purchase_order_items(purchase_order_id,variant_id,quantity,unit_cost,line_total) values($1,$2,$3,$4,$5)",[created.rows[0].id,item.variantId,item.quantity,item.unitCost,item.lineTotal]);
        await client.query(
          `insert into inventory_levels(store_id,location_id,variant_id,available,incoming) values($1,$2,$3,0,$4)
           on conflict(location_id,variant_id) do update set incoming=inventory_levels.incoming+excluded.incoming,updated_at=now()`,
          [store.id,locationId,item.variantId,item.quantity]
        );
      }
      await this.governance.audit(store.id,"purchase_order.created","purchase_order",created.rows[0].id,{actor:body?.actor,after:created.rows[0],metadata:{items:normalized}},client);
      return {...created.rows[0],items:normalized};
    });
  }

  async orderPurchaseOrder(id:string,body:any={}){
    const storeId=await this.context.storeId();
    const result=await this.db.query<any>("update purchase_orders set status='ordered',ordered_at=coalesce(ordered_at,now()),updated_at=now() where id=$1 and store_id=$2 and status='draft' returning *",[id,storeId]);
    if(!result.rowCount) throw new ConflictException("Purchase order is not a draft");
    await this.governance.audit(storeId,"purchase_order.ordered","purchase_order",id,{actor:body?.actor,after:result.rows[0]});
    return result.rows[0];
  }

  async receivePurchaseOrder(id:string,body:any={}){
    const storeId=await this.context.storeId();
    const received=Array.isArray(body?.items)?new Map(body.items.map((item:any)=>[String(item.itemId),Number(item.quantity)])):null;
    return this.db.transaction(async client=>{
      const po=await client.query<any>("select * from purchase_orders where id=$1 and store_id=$2 for update",[id,storeId]);
      if(!po.rowCount) throw new NotFoundException("Purchase order not found");
      if(["received","canceled"].includes(po.rows[0].status)) throw new ConflictException("Purchase order cannot receive more stock");
      const items=await client.query<any>("select * from purchase_order_items where purchase_order_id=$1 for update",[id]);
      let allReceived=true;
      for(const item of items.rows){
        const remaining=Number(item.quantity)-Number(item.received_quantity);
        const qty=received?Number(received.get(String(item.id))||0):remaining;
        if(!Number.isInteger(qty)||qty<0||qty>remaining) throw new BadRequestException("Invalid received quantity");
        if(qty>0){
          const level=await client.query<any>("select * from inventory_levels where location_id=$1 and variant_id=$2 for update",[po.rows[0].location_id,item.variant_id]);
          if(!level.rowCount) throw new ConflictException("Receiving inventory level is missing");
          await client.query("update inventory_levels set incoming=greatest(0,incoming-$1),available=available+$1,updated_at=now() where id=$2",[qty,level.rows[0].id]);
          await client.query("update purchase_order_items set received_quantity=received_quantity+$1 where id=$2",[qty,item.id]);
          const variant=await client.query<any>("select inventory,cost_amount from product_variants where id=$1 for update",[item.variant_id]);
          const oldInventory=Number(variant.rows[0]?.inventory||0);
          const oldCost=Number(variant.rows[0]?.cost_amount||0);
          const total=await client.query<any>("select coalesce(sum(available),0)::int as total from inventory_levels where variant_id=$1",[item.variant_id]);
          const newInventory=Number(total.rows[0]?.total||0);
          const weighted=newInventory>0?Math.round(((Math.max(0,oldInventory)*oldCost)+(qty*Number(item.unit_cost)))/Math.max(1,oldInventory+qty)*100)/100:Number(item.unit_cost);
          await client.query("update product_variants set inventory=$1,cost_amount=$2,updated_at=now() where id=$3",[newInventory,weighted,item.variant_id]);
          await client.query("insert into inventory_movements(store_id,variant_id,movement_type,quantity_delta,quantity_before,quantity_after,reason,actor) values($1,$2,'purchase_receipt',$3,$4,$5,$6,$7)",[storeId,item.variant_id,qty,oldInventory,newInventory,"Received "+po.rows[0].po_number,String(body?.actor||"admin")]);
        }
        if(Number(item.received_quantity)+qty<Number(item.quantity)) allReceived=false;
      }
      const status=allReceived?"received":"partially_received";
      const updated=await client.query<any>("update purchase_orders set status=$1,received_at=case when $1='received' then now() else received_at end,updated_at=now() where id=$2 returning *",[status,id]);
      await this.governance.audit(storeId,"purchase_order.received","purchase_order",id,{actor:body?.actor,after:updated.rows[0],metadata:{partial:!allReceived}},client);
      return updated.rows[0];
    });
  }
}
