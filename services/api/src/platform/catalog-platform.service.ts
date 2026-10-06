import {BadRequestException,Injectable,NotFoundException} from "@nestjs/common";
import {DatabaseService} from "../database/database.service";
import {GovernanceService} from "./governance.service";
import {StoreContextService} from "./store-context.service";

@Injectable()
export class CatalogPlatformService{
  constructor(
    private readonly db:DatabaseService,
    private readonly context:StoreContextService,
    private readonly governance:GovernanceService,
  ){}

  async metafieldDefinitions(ownerType?:string){
    const storeId=await this.context.storeId();
    const result=ownerType
      ?await this.db.query<any>("select * from metafield_definitions where store_id=$1 and owner_type=$2 order by position,namespace,key",[storeId,ownerType])
      :await this.db.query<any>("select * from metafield_definitions where store_id=$1 order by owner_type,position,namespace,key",[storeId]);
    return {items:result.rows};
  }

  async createMetafieldDefinition(body:any){
    const storeId=await this.context.storeId();
    const ownerType=String(body?.ownerType||"product");
    const namespace=String(body?.namespace||"custom").trim().toLowerCase();
    const key=String(body?.key||"").trim().toLowerCase().replace(/[^a-z0-9_]+/g,"_").replace(/^_+|_+$/g,"");
    const name=String(body?.name||key).trim();
    const valueType=String(body?.valueType||"text");
    const allowedOwner=["product","variant","collection","customer","order"];
    const allowedType=["text","multiline_text","number_integer","number_decimal","boolean","date","datetime","url","json"];
    if(!allowedOwner.includes(ownerType)||!namespace||!key||!name||!allowedType.includes(valueType)) throw new BadRequestException("Invalid metafield definition");
    const result=await this.db.query<any>(
      "insert into metafield_definitions(store_id,owner_type,namespace,key,name,description,value_type,validation,position) values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) returning *",
      [storeId,ownerType,namespace,key,name,body.description??null,valueType,JSON.stringify(body.validation||{}),Number(body.position||0)]
    );
    await this.governance.audit(storeId,"metafield.definition.created","metafield_definition",result.rows[0].id,{after:result.rows[0]});
    return result.rows[0];
  }

  private normalizeMetafieldValue(def:any,raw:any){
    const validation=def.validation||{};
    switch(def.value_type){
      case "number_integer":{
        const value=Number(raw);
        if(!Number.isInteger(value)) throw new BadRequestException(def.name+" must be a whole number");
        if(validation.min!==undefined&&value<Number(validation.min)) throw new BadRequestException(def.name+" is below minimum");
        if(validation.max!==undefined&&value>Number(validation.max)) throw new BadRequestException(def.name+" exceeds maximum");
        return value;
      }
      case "number_decimal":{
        const value=Number(raw);
        if(!Number.isFinite(value)) throw new BadRequestException(def.name+" must be a number");
        if(validation.min!==undefined&&value<Number(validation.min)) throw new BadRequestException(def.name+" is below minimum");
        if(validation.max!==undefined&&value>Number(validation.max)) throw new BadRequestException(def.name+" exceeds maximum");
        return value;
      }
      case "boolean": return Boolean(raw===true||raw==="true"||raw===1||raw==="1");
      case "date":
      case "datetime":{
        const date=new Date(String(raw||""));
        if(Number.isNaN(date.getTime())) throw new BadRequestException(def.name+" must be a valid date");
        return def.value_type==="date"?date.toISOString().slice(0,10):date.toISOString();
      }
      case "url":{
        try{
          const parsed=new URL(String(raw||""));
          if(!["http:","https:"].includes(parsed.protocol)) throw new Error("scheme");
          return parsed.toString();
        }catch{throw new BadRequestException(def.name+" must be a valid URL");}
      }
      case "json":{
        if(typeof raw==="string"){
          try{return JSON.parse(raw);}catch{throw new BadRequestException(def.name+" must contain valid JSON");}
        }
        return raw??null;
      }
      default:{
        const value=String(raw??"");
        if(validation.maxLength!==undefined&&value.length>Number(validation.maxLength)) throw new BadRequestException(def.name+" is too long");
        if(validation.allowedValues&&Array.isArray(validation.allowedValues)&&!validation.allowedValues.includes(value)) throw new BadRequestException(def.name+" has an unsupported value");
        return value;
      }
    }
  }

  async metafields(ownerType:string,ownerId:string){
    const storeId=await this.context.storeId();
    const defs=await this.db.query<any>("select * from metafield_definitions where store_id=$1 and owner_type=$2 order by position,namespace,key",[storeId,ownerType]);
    const values=await this.db.query<any>(
      "select mv.*,md.namespace,md.key,md.name,md.value_type from metafield_values mv join metafield_definitions md on md.id=mv.definition_id where mv.store_id=$1 and mv.owner_type=$2 and mv.owner_id=$3",
      [storeId,ownerType,ownerId]
    );
    const byDefinition=new Map(values.rows.map((row:any)=>[row.definition_id,row]));
    return {items:defs.rows.map((def:any)=>({...def,value:byDefinition.get(def.id)?.value??null,valueId:byDefinition.get(def.id)?.id??null}))};
  }

  async setMetafields(ownerType:string,ownerId:string,body:any){
    const storeId=await this.context.storeId();
    const values=Array.isArray(body?.values)?body.values:[];
    return this.db.transaction(async client=>{
      const saved:any[]=[];
      for(const entry of values){
        const defResult=await client.query<any>("select * from metafield_definitions where id=$1 and store_id=$2 and owner_type=$3",[String(entry.definitionId),storeId,ownerType]);
        if(!defResult.rowCount) throw new BadRequestException("Unknown metafield definition");
        const def=defResult.rows[0];
        if(entry.value===null||entry.value===undefined||entry.value===""){
          await client.query("delete from metafield_values where definition_id=$1 and owner_id=$2",[def.id,ownerId]);
          continue;
        }
        const value=this.normalizeMetafieldValue(def,entry.value);
        const result=await client.query<any>(
          `insert into metafield_values(store_id,definition_id,owner_type,owner_id,value)
           values($1,$2,$3,$4,$5::jsonb)
           on conflict(definition_id,owner_id) do update set value=excluded.value,updated_at=now()
           returning *`,
          [storeId,def.id,ownerType,ownerId,JSON.stringify(value)]
        );
        saved.push(result.rows[0]);
      }
      await this.governance.audit(storeId,"metafields.updated",ownerType,ownerId,{after:saved,metadata:{count:saved.length}},client);
      return this.metafields(ownerType,ownerId);
    });
  }

  async updateProductOrganization(productId:string,body:any){
    const storeId=await this.context.storeId();
    const current=await this.db.query<any>("select * from products where id=$1 and store_id=$2",[productId,storeId]);
    if(!current.rowCount) throw new NotFoundException("Product not found");
    const publishedAt=body?.publishedAt?new Date(body.publishedAt):null;
    if(body?.publishedAt&&Number.isNaN(publishedAt!.getTime())) throw new BadRequestException("Invalid publish date");
    const weight=body?.weightGrams===null||body?.weightGrams===""?null:Number(body?.weightGrams);
    if(weight!==null&&(!Number.isFinite(weight)||weight<0)) throw new BadRequestException("Invalid product weight");
    const tags=Array.isArray(body?.tags)?body.tags.map((x:any)=>String(x).trim()).filter(Boolean):String(body?.tags||"").split(",").map((x:string)=>x.trim()).filter(Boolean);
    const result=await this.db.query<any>(
      `update products set vendor=$1,product_type=$2,tags=$3,published_at=$4,search_attributes=$5::jsonb,taxable=$6,weight_grams=$7,updated_at=now()
       where id=$8 and store_id=$9 returning *`,
      [String(body?.vendor||"").trim()||null,String(body?.productType||"").trim()||null,tags,publishedAt?.toISOString()||null,JSON.stringify(body?.searchAttributes||{}),body?.taxable!==false,weight,productId,storeId]
    );
    await this.governance.audit(storeId,"product.organization.updated","product",productId,{before:current.rows[0],after:result.rows[0]});
    return result.rows[0];
  }

  async setVariantCost(variantId:string,body:any){
    const storeId=await this.context.storeId();
    const cost=Number(body?.costAmount??0);
    const weight=body?.weightGrams===null||body?.weightGrams===""?null:Number(body?.weightGrams);
    if(!Number.isFinite(cost)||cost<0||weight!==null&&(!Number.isFinite(weight)||weight<0)) throw new BadRequestException("Invalid variant cost or weight");
    const before=await this.db.query<any>("select v.* from product_variants v join products p on p.id=v.product_id where v.id=$1 and p.store_id=$2",[variantId,storeId]);
    if(!before.rowCount) throw new NotFoundException("Variant not found");
    const result=await this.db.query<any>("update product_variants set cost_amount=$1,weight_grams=$2,updated_at=now() where id=$3 returning *",[cost,weight,variantId]);
    await this.governance.audit(storeId,"variant.cost.updated","variant",variantId,{before:before.rows[0],after:result.rows[0]});
    return result.rows[0];
  }

  async smartCollectionRules(collectionId:string){
    const storeId=await this.context.storeId();
    const collection=await this.db.query<any>("select * from collections where id=$1 and store_id=$2",[collectionId,storeId]);
    if(!collection.rowCount) throw new NotFoundException("Collection not found");
    const rules=await this.db.query<any>("select * from collection_rules where collection_id=$1 order by position,created_at",[collectionId]);
    return {collection:collection.rows[0],rules:rules.rows};
  }

  async setSmartCollectionRules(collectionId:string,body:any){
    const storeId=await this.context.storeId();
    const rules=Array.isArray(body?.rules)?body.rules:[];
    const allowedFields=["category","material","vendor","product_type","status","featured","tag","tags","price","inventory"];
    const allowedOperators=["equals","not_equals","contains","in","gte","lte"];
    for(const rule of rules){
      if(!allowedFields.includes(String(rule.field))||!allowedOperators.includes(String(rule.operator))) throw new BadRequestException("Invalid smart collection rule");
    }
    await this.db.transaction(async client=>{
      const collection=await client.query<any>("select id from collections where id=$1 and store_id=$2 for update",[collectionId,storeId]);
      if(!collection.rowCount) throw new NotFoundException("Collection not found");
      await client.query("delete from collection_rules where collection_id=$1",[collectionId]);
      let position=0;
      for(const rule of rules){
        await client.query("insert into collection_rules(collection_id,field,operator,value,position) values($1,$2,$3,$4::jsonb,$5)",[collectionId,String(rule.field),String(rule.operator),JSON.stringify(rule.value),position++]);
      }
      await client.query("update collections set collection_type='smart',updated_at=now() where id=$1",[collectionId]);
    });
    const refreshed=await this.refreshSmartCollection(collectionId);
    await this.governance.audit(storeId,"collection.rules.updated","collection",collectionId,{after:{rules,matched:refreshed.productCount}});
    return refreshed;
  }

  private ruleMatch(product:any,rule:any){
    let actual:any;
    if(rule.field==="price") actual=Number(product.price||0);
    else if(rule.field==="inventory") actual=Number(product.inventory||0);
    else actual=product[rule.field];
    const expected=rule.value;
    const normalizedExpected=expected&&typeof expected==="object"&&"value" in expected?expected.value:expected;
    switch(rule.operator){
      case "equals": return String(actual??"").toLowerCase()===String(normalizedExpected??"").toLowerCase();
      case "not_equals": return String(actual??"").toLowerCase()!==String(normalizedExpected??"").toLowerCase();
      case "contains":{
        if(Array.isArray(actual)) return actual.map(String).some(v=>v.toLowerCase().includes(String(normalizedExpected??"").toLowerCase()));
        return String(actual??"").toLowerCase().includes(String(normalizedExpected??"").toLowerCase());
      }
      case "in":{
        const list=Array.isArray(expected)?expected:(Array.isArray(expected?.values)?expected.values:[normalizedExpected]);
        return list.map((x:any)=>String(x).toLowerCase()).includes(String(actual??"").toLowerCase());
      }
      case "gte": return Number(actual)>=Number(normalizedExpected);
      case "lte": return Number(actual)<=Number(normalizedExpected);
      default:return false;
    }
  }

  async refreshSmartCollection(collectionId:string){
    const storeId=await this.context.storeId();
    const collection=await this.db.query<any>("select * from collections where id=$1 and store_id=$2",[collectionId,storeId]);
    if(!collection.rowCount) throw new NotFoundException("Collection not found");
    const rules=await this.db.query<any>("select * from collection_rules where collection_id=$1 order by position",[collectionId]);
    const products=await this.db.query<any>(
      `select p.*,coalesce((select min(v.price) from product_variants v where v.product_id=p.id and v.status='active'),0) as price,
       coalesce((select sum(v.inventory) from product_variants v where v.product_id=p.id and v.status='active'),0) as inventory
       from products p where p.store_id=$1 and p.status<>'archived'`,
      [storeId]
    );
    const matched=products.rows.filter((p:any)=>rules.rows.every((r:any)=>this.ruleMatch(p,r)));
    await this.db.transaction(async client=>{
      await client.query("delete from collection_products where collection_id=$1",[collectionId]);
      let position=0;
      for(const product of matched){
        await client.query("insert into collection_products(collection_id,product_id,position) values($1,$2,$3)",[collectionId,product.id,position++]);
      }
    });
    return {collectionId,productCount:matched.length,productIds:matched.map((p:any)=>p.id)};
  }

  async scheduleCollection(collectionId:string,body:any){
    const storeId=await this.context.storeId();
    const publishAt=body?.publishAt?new Date(body.publishAt):null;
    const unpublishAt=body?.unpublishAt?new Date(body.unpublishAt):null;
    if(publishAt&&Number.isNaN(publishAt.getTime())||unpublishAt&&Number.isNaN(unpublishAt.getTime())) throw new BadRequestException("Invalid collection schedule");
    if(publishAt&&unpublishAt&&unpublishAt<=publishAt) throw new BadRequestException("Unpublish time must be after publish time");
    const result=await this.db.query<any>("update collections set publish_at=$1,unpublish_at=$2,updated_at=now() where id=$3 and store_id=$4 returning *",[publishAt?.toISOString()||null,unpublishAt?.toISOString()||null,collectionId,storeId]);
    if(!result.rowCount) throw new NotFoundException("Collection not found");
    await this.governance.audit(storeId,"collection.schedule.updated","collection",collectionId,{after:result.rows[0]});
    return result.rows[0];
  }
}
