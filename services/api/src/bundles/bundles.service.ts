import {BadRequestException,ConflictException,Injectable,NotFoundException} from "@nestjs/common";
import {PoolClient} from "pg";
import {DatabaseService} from "../database/database.service";
import {ProductsService} from "../products/products.service";

type BundleComponent={variantId:string;quantity:number};
type BundleRow={id:string;store_id:string;handle:string;title:string;description:string;status:string;discount_kind:"percentage"|"fixed";discount_value:string;starts_at:string|null;ends_at:string|null};
const money=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;
const validUuid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

@Injectable()
export class BundlesService{
  constructor(private readonly db:DatabaseService,private readonly products:ProductsService){}

  private async storeId(){
    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    const res=await this.db.query<{id:string}>("select id from stores where domain=$1 limit 1",[domain]);
    if(!res.rowCount)throw new NotFoundException("Store not configured");
    return res.rows[0].id;
  }
  private validate(body:any){
    const title=String(body?.title||"").trim();
    const handle=String(body?.handle||"").trim().toLowerCase();
    const description=String(body?.description||"").trim();
    const status=String(body?.status||"draft");
    const kind=String(body?.discountKind||"percentage");
    const value=Number(body?.discountValue);
    const components:Array<BundleComponent>=Array.isArray(body?.components)?body.components.map((x:any)=>({variantId:String(x.variantId||""),quantity:Number(x.quantity)})):[];
    if(title.length<2||title.length>150||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle)||handle.length>120||description.length>2000)throw new BadRequestException("Valid title, handle and description are required");
    if(!["draft","active","archived"].includes(status))throw new BadRequestException("Invalid bundle status");
    if(!["percentage","fixed"].includes(kind)||!Number.isFinite(value)||value<0||value>999999||(kind==="percentage"&&value>100))throw new BadRequestException("Invalid discount value");
    if(components.length<2||components.length>10||components.some(c=>!validUuid(c.variantId)||!Number.isInteger(c.quantity)||c.quantity<1||c.quantity>25)||new Set(components.map(c=>c.variantId)).size!==components.length)throw new BadRequestException("Choose 2–10 different variants with quantities of 1–25");
    const starts=body.startsAt?new Date(String(body.startsAt)):null;
    const ends=body.endsAt?new Date(String(body.endsAt)):null;
    if((starts&&!Number.isFinite(starts.valueOf()))||(ends&&!Number.isFinite(ends.valueOf()))||(starts&&ends&&starts>=ends))throw new BadRequestException("Invalid offer dates");
    return {title,handle,description,status,kind,value,components,starts,ends};
  }
  async variantChoices(){
    const storeId=await this.storeId();
    const result=await this.db.query<any>(
      "select v.id as variant_id,v.sku,v.title as variant_title,v.price,v.inventory,v.status as variant_status,p.id as product_id,p.title as product_title,p.handle,p.status as product_status,coalesce((select jsonb_object_agg(o.name,ov.value) from variant_option_values vv join product_option_values ov on ov.id=vv.option_value_id join product_options o on o.id=ov.option_id where vv.variant_id=v.id),'{}'::jsonb) as options from product_variants v join products p on p.id=v.product_id where p.store_id=$1 order by p.title,v.created_at limit 1200",
      [storeId]
    );
    return {items:result.rows.map((x:any)=>({...x,price:Number(x.price),inventory:Number(x.inventory)}))};
  }
  async listAdmin(){
    const storeId=await this.storeId();
    const r=await this.db.query<any>("select * from jewelry_bundles where store_id=$1 order by updated_at desc limit 200",[storeId]);
    const items=[];
    for(const row of r.rows)items.push(await this.describe(row,false));
    return {items};
  }
  async detailAdmin(id:string){
    const storeId=await this.storeId();
    const r=await this.db.query<BundleRow>("select * from jewelry_bundles where id=$1 and store_id=$2 limit 1",[id,storeId]);
    if(!r.rowCount)throw new NotFoundException("Bundle not found");
    return this.describe(r.rows[0],false);
  }
  private async describe(row:BundleRow,publicOnly:boolean){
    const query="select bc.variant_id,bc.quantity,v.price,v.inventory,v.status as variant_status,v.sku,p.title as product_title,p.handle as product_handle,p.status as product_status,p.published_at,coalesce((select jsonb_object_agg(o.name,ov.value) from variant_option_values vv join product_option_values ov on ov.id=vv.option_value_id join product_options o on o.id=ov.option_id where vv.variant_id=v.id),'{}'::jsonb) as selected_options from jewelry_bundle_components bc join product_variants v on v.id=bc.variant_id join products p on p.id=v.product_id where bc.bundle_id=$1 order by bc.position,bc.id";
    const result=await this.db.query<any>(query,[row.id]);
    const components=result.rows.map((x:any)=>({...x,variantId:x.variant_id,quantity:Number(x.quantity),price:Number(x.price),inventory:Number(x.inventory)}));
    const gross=money(components.reduce((sum:number,c:any)=>sum+c.price*c.quantity,0));
    const discount=money(Math.min(gross,row.discount_kind==="percentage"?gross*Number(row.discount_value)/100:Number(row.discount_value)));
    const eligible=row.status==="active"&&(!row.starts_at||new Date(row.starts_at).getTime()<=Date.now())&&(!row.ends_at||new Date(row.ends_at).getTime()>=Date.now())&&components.length>=2&&components.every((c:any)=>c.variant_status==="active"&&c.product_status==="active"&&(!c.published_at||new Date(c.published_at).getTime()<=Date.now())&&c.inventory>=c.quantity);
    if(publicOnly&&!eligible)return null;
    return {id:row.id,handle:row.handle,title:row.title,description:row.description,status:row.status,
      discountKind:row.discount_kind,discountValue:Number(row.discount_value),
      startsAt:row.starts_at,endsAt:row.ends_at,
      components,regularPrice:gross,bundlePrice:money(gross-discount),saving:discount,
      maxQuantity:eligible?Math.min(25,...components.map((c:any)=>Math.min(Math.floor(c.inventory/c.quantity),Math.floor(25/c.quantity)))):0,eligible};
  }
  async listPublic(){
    const storeId=await this.storeId();
    const r=await this.db.query<BundleRow>("select * from jewelry_bundles where store_id=$1 and status='active' and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()) order by created_at desc limit 80",[storeId]);
    const catalog=await this.products.listStorefront();
    const byHandle=new Map<string,any>(catalog.map((x:any)=>[String(x.slug),x] as const));
    const items=[];
    for(const row of r.rows){
      const item=await this.describe(row,true);
      if(!item)continue;
      const components=item.components.map((c:any)=>({...c,image:byHandle.get(c.product_handle)?.image||null}));
      items.push({...item,components});
    }
    return {items};
  }
  async create(body:any){return this.save(null,body);}
  async update(id:string,body:any){return this.save(id,body);}
  private async save(id:string|null,body:any){
    const fields=this.validate(body);
    const storeId=await this.storeId();
    return this.db.transaction(async client=>{
      const sorted=fields.components.map(c=>c.variantId).sort();
      const found=await client.query<any>("select v.id,v.price,v.status,p.store_id,p.status as product_status from product_variants v join products p on p.id=v.product_id where v.id=any($1::uuid[]) order by v.id for update of v",[sorted]);
      if(found.rowCount!==sorted.length||found.rows.some((r:any)=>r.store_id!==storeId||r.status!=="active"||r.product_status!=="active"))throw new BadRequestException("Every bundle component must be an active variant from this store");
      const gross=fields.components.reduce((sum,c)=>sum*1+Number(found.rows.find((x:any)=>x.id===c.variantId).price)*c.quantity,0);
      if(fields.kind==="fixed"&&fields.value>gross)throw new BadRequestException("Fixed saving must not exceed the component total");
      let bundleId=id;
      if(id){
        const previous=await client.query("select id from jewelry_bundles where id=$1 and store_id=$2 for update",[id,storeId]);
        if(!previous.rowCount)throw new NotFoundException("Bundle not found");
        await client.query("update jewelry_bundles set handle=$1,title=$2,description=$3,status=$4,discount_kind=$5,discount_value=$6,starts_at=$7,ends_at=$8,updated_at=now() where id=$9",[fields.handle,fields.title,fields.description,fields.status,fields.kind,fields.value,fields.starts,fields.ends,id]);
        await client.query("delete from jewelry_bundle_components where bundle_id=$1",[id]);
      }else{
        const created=await client.query<{id:string}>("insert into jewelry_bundles(store_id,handle,title,description,status,discount_kind,discount_value,starts_at,ends_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id",[storeId,fields.handle,fields.title,fields.description,fields.status,fields.kind,fields.value,fields.starts,fields.ends]);
        bundleId=created.rows[0].id;
      }
      for(const [position,c] of fields.components.entries()){
        await client.query("insert into jewelry_bundle_components(bundle_id,variant_id,quantity,position) values($1,$2,$3,$4)",[bundleId,c.variantId,c.quantity,position]);
      }
      await client.query("insert into audit_log(store_id,actor,action,resource_type,resource_id,after_state) values($1,'admin',$2,'bundle',$3,$4::jsonb)",[storeId,id?"bundle.updated":"bundle.created",bundleId,JSON.stringify(fields)]);
      return {id:bundleId,ok:true};
    });
  }
  async archive(id:string){
    const storeId=await this.storeId();
    return this.db.transaction(async client=>{
      const before=await client.query<any>("select * from jewelry_bundles where id=$1 and store_id=$2 for update",[id,storeId]);
      if(!before.rowCount)throw new NotFoundException("Bundle not found");
      if(before.rows[0].status==="archived")return {ok:true,idempotent:true};
      const result=await client.query<any>("update jewelry_bundles set status='archived',updated_at=now() where id=$1 and store_id=$2 returning *",[id,storeId]);
      await client.query("insert into audit_log(store_id,actor,action,resource_type,resource_id,before_state,after_state) values($1,'admin','bundle.archived','bundle',$2,$3::jsonb,$4::jsonb)",[storeId,id,JSON.stringify(before.rows[0]),JSON.stringify(result.rows[0])]);
      return {ok:true};
    });
  }

  /** Server pricing: a bundle always expands to real inventory-bearing variant lines. */
  async purchase(client:PoolClient,storeId:string,id:string,quantity:number){
    if(!validUuid(id)||!Number.isInteger(quantity)||quantity<1||quantity>25)throw new BadRequestException("Invalid bundle quantity");
    const bundle=await client.query<BundleRow>("select * from jewelry_bundles where id=$1 and store_id=$2 and status='active' and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()) for share",[id,storeId]);
    if(!bundle.rowCount)throw new ConflictException("Bundle is unavailable");
    const detail=await client.query<any>("select bc.variant_id,bc.quantity,v.sku,v.price,v.inventory,v.status,v.product_id,p.title,p.handle,p.store_id as product_store_id,p.status as product_status,p.taxable,p.published_at,coalesce((select jsonb_object_agg(o.name,ov.value) from variant_option_values vv join product_option_values ov on ov.id=vv.option_value_id join product_options o on o.id=ov.option_id where vv.variant_id=v.id),'{}'::jsonb) as selected_options from jewelry_bundle_components bc join product_variants v on v.id=bc.variant_id join products p on p.id=v.product_id where bc.bundle_id=$1 order by bc.position,bc.id",[id]);
    if(detail.rowCount<2)throw new ConflictException("Bundle is incomplete");
    const components=detail.rows.map((v:any)=>({...v,quantity:Number(v.quantity)}));
    for(const c of components){
      if(c.product_store_id!==storeId||c.status!=="active"||c.product_status!=="active"||(c.published_at&&new Date(c.published_at).getTime()>Date.now())||Number(c.inventory)<c.quantity*quantity)throw new ConflictException("A bundle component is unavailable or out of stock");
    }
    const gross=money(components.reduce((sum:number,c:any)=>sum+Number(c.price)*c.quantity,0));
    const unitSaving=money(Math.min(gross,bundle.rows[0].discount_kind==="percentage"?gross*Number(bundle.rows[0].discount_value)/100:Number(bundle.rows[0].discount_value)));
    const snapshot=components.map((c:any)=>({variantId:c.variant_id,quantity:c.quantity}));
    return {title:bundle.rows[0].title,bundleId:id,quantity,components,grossAmount:money(gross*quantity),discountAmount:money(unitSaving*quantity),snapshot};
  }
  async checkoutDiscount(client:PoolClient,storeId:string,checkoutId:string){
    const rows=await client.query<any>("select * from checkout_bundle_allocations where checkout_id=$1 order by id",[checkoutId]);
    let discount=0,taxableDiscount=0;
    for(const row of rows.rows){
      const current=await this.purchase(client,storeId,String(row.bundle_id),Number(row.quantity));
      // PostgreSQL jsonb normalizes object-key ordering. Compare stable
      // variant/quantity tuples instead of raw JSON.stringify object keys.
      const saved=Array.isArray(row.component_snapshot)?row.component_snapshot:[];
      const sameComponents=saved.length===current.snapshot.length&&
        current.snapshot.every((component,index)=>{
          const prior=saved[index];
          return String(prior?.variantId||"")===component.variantId &&
            Number(prior?.quantity)===component.quantity;
        });
      if(!sameComponents)throw new ConflictException("Bundle contents changed. Please restart checkout.");
      // Immutable audit snapshots: do not fulfill against a different price or
      // discount than the customer originally selected, even on a 100%-off set.
      if(Math.round(current.grossAmount*100)!==Math.round(Number(row.gross_amount)*100)
        ||Math.round(current.discountAmount*100)!==Math.round(Number(row.discount_amount)*100)){
        throw new ConflictException("Bundle pricing changed. Please restart checkout.");
      }
      discount=money(discount+current.discountAmount);
      const taxableGross=current.components.filter((c:any)=>c.taxable!==false)
        .reduce((sum:number,c:any)=>sum+Number(c.price)*Number(c.quantity),0)*current.quantity;
      taxableDiscount=money(taxableDiscount+(current.grossAmount>0
        ?current.discountAmount*(taxableGross/current.grossAmount):0));
    }
    return {bundleCount:rows.rowCount,discount,taxableDiscount};
  }
}
