import {BadRequestException,Injectable} from "@nestjs/common";
import type {PoolClient} from "pg";
import {DatabaseService} from "../database/database.service";

export type PricingLine={
  productId:string;
  variantId?:string|null;
  quantity:number;
  unitPrice:number;
  lineTotal:number;
  productType?:string|null;
  taxable?:boolean;
  weightGrams?:number;
};

type Queryable={query:(text:string,params?:any[])=>Promise<any>};

@Injectable()
export class PricingEngineService{
  constructor(private readonly db:DatabaseService){}

  private async queryable(client?:PoolClient):Promise<Queryable>{
    return client??this.db;
  }

  async price(
    storeId:string,
    lines:PricingLine[],
    options:{
      discountCode?:string|null;
      shippingAddress?:any;
      shippingRateId?:string|null;
      customerId?:string|null;
    }={},
    client?:PoolClient,
  ){
    const q=await this.queryable(client);
    const subtotal=this.money(lines.reduce((sum,line)=>sum+Number(line.lineTotal||0),0));
    const totalWeight=lines.reduce((sum,line)=>sum+(Number(line.weightGrams||0)*Number(line.quantity||0)),0);
    const discount=await this.discount(storeId,lines,subtotal,options.discountCode||null,options.customerId||null,q);
    const shipping=await this.shipping(storeId,options.shippingAddress||{},subtotal-discount.amount,totalWeight,options.shippingRateId||null,q);
    const taxableGross=this.money(lines.filter(line=>line.taxable!==false).reduce((sum,line)=>sum+Number(line.lineTotal||0),0));
    const taxableDiscountShare=subtotal>0?this.money(discount.amount*(taxableGross/subtotal)):0;
    const taxableBase=this.money(Math.max(0,taxableGross-taxableDiscountShare));
    const tax=await this.tax(storeId,options.shippingAddress||{},lines,taxableBase,q);
    const total=this.money(Math.max(0,subtotal-discount.amount+shipping.amount+tax.amount));
    return {subtotal,discount:{...discount,taxableDiscountShare},shipping,tax,total,totalWeight};
  }

  private money(value:number){return Math.round((Number(value)||0)*100)/100;}

  private async discount(storeId:string,lines:PricingLine[],subtotal:number,code:string|null,customerId:string|null,q:Queryable){
    const normalized=String(code||"").trim().toLowerCase();
    const result=await q.query(
      `select * from discounts
       where store_id=$1 and active=true
         and (starts_at is null or starts_at<=now())
         and (ends_at is null or ends_at>now())
         and (usage_limit is null or usage_count<usage_limit)
         and (($2='' and discount_type='automatic') or ($2<>'' and (lower(coalesce(code,''))=$2 or discount_type='automatic')))
       order by case when lower(coalesce(code,''))=$2 then 0 else 1 end,created_at asc`,
      [storeId,normalized]
    );

    let best:any={amount:0,discountId:null,code:null,name:null,taxableDiscountShare:0};
    for(const row of result.rows){
      if(normalized&&row.discount_type!=="automatic"&&String(row.code||"").toLowerCase()!==normalized) continue;
      if(Number(row.minimum_subtotal||0)>subtotal) continue;
      let eligible=subtotal;
      if(row.target_type==="product"&&Array.isArray(row.target_ids)&&row.target_ids.length){
        const targets=new Set(row.target_ids.map(String));
        eligible=lines.filter(line=>targets.has(line.productId)).reduce((sum,line)=>sum+line.lineTotal,0);
      }else if(row.target_type==="collection"&&Array.isArray(row.target_ids)&&row.target_ids.length){
        const collections=await q.query(
          "select distinct product_id from collection_products where collection_id=any($1::uuid[])",
          [row.target_ids]
        );
        const targets=new Set(collections.rows.map((item:any)=>String(item.product_id)));
        eligible=lines.filter(line=>targets.has(line.productId)).reduce((sum,line)=>sum+line.lineTotal,0);
      }
      if(eligible<=0) continue;

      let calculation=String(row.discount_type);
      if(calculation==="automatic") calculation=String(row.metadata?.calculation||"percentage");
      let amount=calculation==="percentage"
        ? eligible*Math.min(100,Number(row.value||0))/100
        : Math.min(eligible,Number(row.value||0));
      const maxDiscount=Number(row.metadata?.max_discount||0);
      if(maxDiscount>0) amount=Math.min(amount,maxDiscount);
      amount=this.money(Math.max(0,amount));
      if(amount>best.amount){
        best={
          amount,
          discountId:row.id,
          code:row.code||null,
          name:row.name,
          taxableDiscountShare:subtotal>0?this.money(amount*(eligible/subtotal)):0,
        };
      }
    }

    if(normalized&&!best.discountId){
      const exists=await q.query("select id from discounts where store_id=$1 and lower(coalesce(code,''))=$2 limit 1",[storeId,normalized]);
      if(exists.rowCount) throw new BadRequestException("Discount code is not currently eligible");
      throw new BadRequestException("Invalid discount code");
    }
    return best;
  }

  private async shipping(storeId:string,address:any,orderValue:number,weightGrams:number,rateId:string|null,q:Queryable){
    const country=String(address?.country||"Pakistan").trim().toLowerCase();
    const region=String(address?.region||"").trim().toLowerCase();
    const city=String(address?.city||"").trim().toLowerCase();
    const zones=await q.query(
      `select * from shipping_zones
       where store_id=$1 and active=true
       order by priority asc,created_at asc`,
      [storeId]
    );
    const zone=zones.rows.find((item:any)=>{
      const countries=(item.countries||[]).map((v:string)=>v.toLowerCase());
      const regions=(item.regions||[]).map((v:string)=>v.toLowerCase());
      const cities=(item.cities||[]).map((v:string)=>v.toLowerCase());
      return (!countries.length||countries.includes(country))
        &&(!regions.length||regions.includes(region))
        &&(!cities.length||cities.includes(city));
    });
    if(!zone) return {amount:0,rateId:null,name:"Standard",carrier:null,zoneId:null};

    const rates=await q.query(
      `select * from shipping_rates where zone_id=$1 and active=true
       order by priority asc,created_at asc`,
      [zone.id]
    );
    const eligible=rates.rows.filter((rate:any)=>{
      if(rate.min_order_value!==null&&Number(rate.min_order_value)>orderValue) return false;
      if(rate.max_order_value!==null&&Number(rate.max_order_value)<orderValue) return false;
      if(rate.min_weight_grams!==null&&Number(rate.min_weight_grams)>weightGrams) return false;
      if(rate.max_weight_grams!==null&&Number(rate.max_weight_grams)<weightGrams) return false;
      return true;
    });
    const rate=rateId?eligible.find((item:any)=>item.id===rateId):eligible[0];
    if(!rate) return {amount:0,rateId:null,name:"Standard",carrier:null,zoneId:zone.id};
    const amount=rate.rate_type==="free"?0:this.money(Number(rate.amount||0));
    return {amount,rateId:rate.id,name:rate.name,carrier:rate.carrier||null,serviceCode:rate.service_code||null,zoneId:zone.id};
  }

  private async tax(storeId:string,address:any,lines:PricingLine[],taxableBase:number,q:Queryable){
    const country=String(address?.country||"Pakistan").trim().toLowerCase();
    const region=String(address?.region||"").trim().toLowerCase();
    const city=String(address?.city||"").trim().toLowerCase();
    const storeResult=await q.query("select prices_include_tax from stores where id=$1",[storeId]);
    const pricesIncludeTax=Boolean(storeResult.rows[0]?.prices_include_tax);
    const rules=await q.query(
      `select * from tax_rules where store_id=$1 and active=true
       order by priority asc,
       (case when city is not null then 3 when region is not null then 2 when country is not null then 1 else 0 end) desc,
       created_at asc`,
      [storeId]
    );
    const rule=rules.rows.find((item:any)=>{
      if(item.country&&String(item.country).toLowerCase()!==country) return false;
      if(item.region&&String(item.region).toLowerCase()!==region) return false;
      if(item.city&&String(item.city).toLowerCase()!==city) return false;
      const types=(item.product_types||[]).map((v:string)=>v.toLowerCase());
      if(types.length&&!lines.some(line=>types.includes(String(line.productType||"").toLowerCase()))) return false;
      return true;
    });
    if(!rule||taxableBase<=0) return {amount:0,rate:0,ruleId:null,name:null,pricesIncludeTax};
    const rate=Number(rule.rate||0);
    const amount=pricesIncludeTax
      ? this.money(taxableBase-(taxableBase/(1+rate)))
      : this.money(taxableBase*rate);
    return {amount,rate,ruleId:rule.id,name:rule.name,pricesIncludeTax};
  }
}
