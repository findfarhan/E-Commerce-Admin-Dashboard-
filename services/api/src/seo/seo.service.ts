import {BadRequestException,Injectable,NotFoundException} from "@nestjs/common";
import {DatabaseService} from "../database/database.service";

@Injectable()
export class SeoService{
  constructor(private readonly db:DatabaseService){}

  private async storeId(){
    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    const result=await this.db.query<{id:string}>("select id from stores where domain=$1 limit 1",[domain]);
    if(!result.rowCount) throw new NotFoundException("Store is not configured");
    return result.rows[0].id;
  }

  async get(resourceType:string,resourceId:string){
    const storeId=await this.storeId();
    const result=await this.db.query<any>("select * from seo_documents where store_id=$1 and resource_type=$2 and resource_id=$3 and locale='en-PK' limit 1",[storeId,resourceType,resourceId]);
    return result.rows[0]||null;
  }

  async upsert(resourceType:string,resourceId:string,body:any){
    if(!["product","collection","page","content"].includes(resourceType)) throw new BadRequestException("Unsupported SEO resource type");
    const storeId=await this.storeId();
    const canonicalPath=String(body?.canonicalPath||"").trim();
    if(!canonicalPath.startsWith("/")) throw new BadRequestException("canonicalPath must start with /");
    const result=await this.db.query<any>("insert into seo_documents(store_id,resource_type,resource_id,locale,title,meta_description,canonical_path,robots_index,robots_follow,schema_type,metadata) values($1,$2,$3,'en-PK',$4,$5,$6,$7,$8,$9,$10::jsonb) on conflict(store_id,resource_type,resource_id,locale) do update set title=excluded.title,meta_description=excluded.meta_description,canonical_path=excluded.canonical_path,robots_index=excluded.robots_index,robots_follow=excluded.robots_follow,schema_type=excluded.schema_type,metadata=excluded.metadata returning *",[storeId,resourceType,resourceId,body.title??null,body.metaDescription??null,canonicalPath,body.index!==false,body.follow!==false,body.schemaType??null,JSON.stringify(body.metadata||{})]);
    return result.rows[0];
  }
}
