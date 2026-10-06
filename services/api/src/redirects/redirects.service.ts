import {BadRequestException,Injectable,NotFoundException} from "@nestjs/common";
import {DatabaseService} from "../database/database.service";

@Injectable()
export class RedirectsService{
  constructor(private readonly db:DatabaseService){}

  private async storeId(){
    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    const result=await this.db.query<{id:string}>("select id from stores where domain=$1 limit 1",[domain]);
    if(!result.rowCount) throw new NotFoundException("Store is not configured");
    return result.rows[0].id;
  }

  private normalize(value:any){
    const path=String(value||"").trim();
    if(!path.startsWith("/")) throw new BadRequestException("Redirect paths must start with /");
    if(path.startsWith("//")) throw new BadRequestException("Invalid redirect path");
    return path;
  }

  async list(){
    const storeId=await this.storeId();
    const result=await this.db.query<any>("select * from url_redirects where store_id=$1 order by created_at desc",[storeId]);
    return {items:result.rows};
  }

  async create(body:any){
    const storeId=await this.storeId();
    const source=this.normalize(body?.sourcePath);
    const target=this.normalize(body?.targetPath);
    if(source===target) throw new BadRequestException("Source and target cannot match");
    const status=Number(body?.statusCode||301);
    if(![301,302,307,308].includes(status)) throw new BadRequestException("Unsupported redirect status");
    const result=await this.db.query<any>("insert into url_redirects(store_id,source_path,target_path,status_code,enabled) values($1,$2,$3,$4,true) on conflict(store_id,source_path) do update set target_path=excluded.target_path,status_code=excluded.status_code,enabled=true returning *",[storeId,source,target,status]);
    return result.rows[0];
  }

  async remove(id:string){
    const storeId=await this.storeId();
    const result=await this.db.query<any>("delete from url_redirects where id=$1 and store_id=$2 returning id",[id,storeId]);
    if(!result.rowCount) throw new NotFoundException("Redirect not found");
    return {ok:true,id};
  }

  async resolve(path:string){
    const storeId=await this.storeId();
    const result=await this.db.query<any>("select target_path,status_code from url_redirects where store_id=$1 and source_path=$2 and enabled=true limit 1",[storeId,path]);
    return result.rows[0]||null;
  }
}
