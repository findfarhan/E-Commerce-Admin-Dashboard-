import {BadRequestException,Injectable,NotFoundException} from "@nestjs/common";
import {DatabaseService} from "../database/database.service";

type RequestedLine={
  slug?:string;
  variantId?:string;
  quantity?:number;
};

@Injectable()
export class CheckoutService{
  constructor(private readonly db:DatabaseService){}

  private async store(){
    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    const result=await this.db.query<any>("select id,currency from stores where domain=$1 limit 1",[domain]);
    if(!result.rowCount) throw new NotFoundException("Store is not configured");
    return result.rows[0];
  }

  async create(body:any){
    const requested=Array.isArray(body?.items)?body.items as RequestedLine[]:[];
    if(!requested.length) throw new BadRequestException("At least one cart item is required");
    if(requested.length>50) throw new BadRequestException("Too many cart lines");

    const store=await this.store();

    return this.db.transaction(async client=>{
      const priced:any[]=[];

      for(const item of requested){
        const quantity=Math.max(1,Math.min(25,Number(item.quantity||1)));
        let variant:any=null;

        if(item.variantId){
          const found=await client.query<any>(`
            select
              v.id as variant_id,
              v.sku,
              v.price,
              v.inventory,
              p.id as product_id,
              p.handle,
              p.title,
              coalesce((
                select jsonb_object_agg(o.name,ov.value)
                from variant_option_values vv
                join product_option_values ov on ov.id=vv.option_value_id
                join product_options o on o.id=ov.option_id
                where vv.variant_id=v.id
              ),'{}'::jsonb) as selected_options
            from product_variants v
            join products p on p.id=v.product_id
            where v.id=$1 and p.store_id=$2 and p.status='active' and v.status='active'
            limit 1
          `,[item.variantId,store.id]);
          variant=found.rows[0];
        }else if(item.slug){
          const found=await client.query<any>(`
            select
              v.id as variant_id,
              v.sku,
              v.price,
              v.inventory,
              p.id as product_id,
              p.handle,
              p.title,
              coalesce((
                select jsonb_object_agg(o.name,ov.value)
                from variant_option_values vv
                join product_option_values ov on ov.id=vv.option_value_id
                join product_options o on o.id=ov.option_id
                where vv.variant_id=v.id
              ),'{}'::jsonb) as selected_options
            from products p
            join product_variants v on v.product_id=p.id
            where p.store_id=$1 and p.handle=$2 and p.status='active' and v.status='active'
            order by v.created_at
            limit 1
          `,[store.id,item.slug]);
          variant=found.rows[0];
        }

        if(!variant) throw new BadRequestException("A cart item is no longer available");
        if(Number(variant.inventory)<quantity){
          throw new BadRequestException(variant.sku+" has only "+variant.inventory+" item(s) available");
        }

        const unitPrice=Number(variant.price);
        priced.push({
          ...variant,
          quantity,
          unitPrice,
          lineTotal:unitPrice*quantity,
        });
      }

      const subtotal=priced.reduce((sum,line)=>sum+line.lineTotal,0);
      const checkout=await client.query<any>(`
        insert into checkout_sessions(store_id,status,currency,subtotal)
        values($1,'open',$2,$3)
        returning id,status,currency,subtotal,expires_at,created_at
      `,[store.id,store.currency||"PKR",subtotal]);

      for(const line of priced){
        await client.query(`
          insert into checkout_lines(
            checkout_id,product_id,variant_id,sku_snapshot,title_snapshot,
            selected_options,quantity,unit_price,line_total
          )
          values($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)
        `,[
          checkout.rows[0].id,
          line.product_id,
          line.variant_id,
          line.sku,
          line.title,
          JSON.stringify(line.selected_options||{}),
          line.quantity,
          line.unitPrice,
          line.lineTotal,
        ]);
      }

      return {
        ...checkout.rows[0],
        subtotal:Number(checkout.rows[0].subtotal),
        items:priced.map(line=>({
          productId:line.product_id,
          variantId:line.variant_id,
          slug:line.handle,
          title:line.title,
          sku:line.sku,
          selectedOptions:line.selected_options||{},
          quantity:line.quantity,
          unitPrice:line.unitPrice,
          lineTotal:line.lineTotal,
        })),
      };
    });
  }

  async detail(id:string){
    const store=await this.store();
    const checkout=await this.db.query<any>(
      "select * from checkout_sessions where id=$1 and store_id=$2 limit 1",
      [id,store.id]
    );
    if(!checkout.rowCount) throw new NotFoundException("Checkout not found");

    const lines=await this.db.query<any>(
      "select id,product_id,variant_id,sku_snapshot,title_snapshot,selected_options,quantity,unit_price,line_total from checkout_lines where checkout_id=$1 order by id",
      [id]
    );

    return {
      ...checkout.rows[0],
      subtotal:Number(checkout.rows[0].subtotal),
      items:lines.rows.map(line=>({
        ...line,
        unit_price:Number(line.unit_price),
        line_total:Number(line.line_total),
      })),
    };
  }

  async setCustomer(id:string,body:any){
    const store=await this.store();
    const email=String(body?.email||"").trim().toLowerCase();
    if(!email||!email.includes("@")) throw new BadRequestException("A valid email is required");

    const result=await this.db.query<any>(`
      update checkout_sessions
      set customer_email=$1,customer_name=$2,customer_phone=$3,updated_at=now()
      where id=$4 and store_id=$5 and status='open' and expires_at>now()
      returning id,status,currency,subtotal,customer_email,customer_name,customer_phone,expires_at
    `,[
      email,
      String(body?.name||"").trim()||null,
      String(body?.phone||"").trim()||null,
      id,
      store.id,
    ]);

    if(!result.rowCount) throw new NotFoundException("Open checkout not found");
    return {...result.rows[0],subtotal:Number(result.rows[0].subtotal)};
  }
}
