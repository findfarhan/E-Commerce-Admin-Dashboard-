import {BadRequestException,Injectable,NotFoundException} from "@nestjs/common";
import {DatabaseService} from "../database/database.service";

@Injectable()
export class EngagementService{
  constructor(private readonly db:DatabaseService){}

  private async storeId(){
    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    const result=await this.db.query<{id:string}>("select id from stores where domain=$1 limit 1",[domain]);
    if(!result.rowCount) throw new NotFoundException("Store is not configured");
    return result.rows[0].id;
  }

  private normalizeEmail(value:any){
    const email=String(value||"").trim().toLowerCase();
    if(!email||!email.includes("@")||email.length>254) throw new BadRequestException("A valid email is required");
    return email;
  }

  async subscribe(body:any){
    const storeId=await this.storeId();
    const email=this.normalizeEmail(body?.email);
    const source=String(body?.source||"storefront").trim().slice(0,80)||"storefront";
    const result=await this.db.query<any>(
      "insert into newsletter_subscribers(store_id,email,status,source) values($1,$2,'subscribed',$3) on conflict(store_id,lower(email)) do update set status='subscribed',source=excluded.source,updated_at=now() returning id,email,status,created_at,updated_at",
      [storeId,email,source]
    );
    return {ok:true,subscriber:result.rows[0]};
  }

  async createCommission(body:any){
    const storeId=await this.storeId();
    const name=String(body?.name||"").trim();
    const email=this.normalizeEmail(body?.email);
    const phone=String(body?.phone||"").trim();
    const notes=String(body?.notes||"").trim();
    if(!name) throw new BadRequestException("Name is required");
    if(!notes||notes.length<10) throw new BadRequestException("Tell us a little more about the commission");
    if(name.length>120||phone.length>40||notes.length>5000) throw new BadRequestException("Commission request is too long");

    const result=await this.db.query<any>(
      "insert into custom_commission_requests(store_id,name,email,phone,signal,preferred_material,budget_range,timeline,notes,status,source) values($1,$2,$3,$4,$5,$6,$7,$8,$9,'new',$10) returning *",
      [
        storeId,name,email,phone||null,
        String(body?.signal||"").trim().slice(0,160)||null,
        String(body?.preferredMaterial||"").trim().slice(0,120)||null,
        String(body?.budgetRange||"").trim().slice(0,120)||null,
        String(body?.timeline||"").trim().slice(0,120)||null,
        notes,
        String(body?.source||"custom-page").trim().slice(0,80)||"custom-page",
      ]
    );
    return {ok:true,request:{id:result.rows[0].id,status:result.rows[0].status,createdAt:result.rows[0].created_at}};
  }

  async listCommissions(){
    const storeId=await this.storeId();
    const result=await this.db.query<any>(
      "select * from custom_commission_requests where store_id=$1 order by case status when 'new' then 0 when 'contacted' then 1 when 'qualified' then 2 else 3 end,created_at desc limit 500",
      [storeId]
    );
    return {items:result.rows};
  }

  async updateCommission(id:string,body:any){
    const storeId=await this.storeId();
    const status=String(body?.status||"").trim();
    const allowed=["new","contacted","qualified","won","closed"];
    if(!allowed.includes(status)) throw new BadRequestException("Invalid commission status");
    const result=await this.db.query<any>(
      "update custom_commission_requests set status=$1,updated_at=now() where id=$2 and store_id=$3 returning *",
      [status,id,storeId]
    );
    if(!result.rowCount) throw new NotFoundException("Commission request not found");
    return result.rows[0];
  }

  async listSubscribers(){
    const storeId=await this.storeId();
    const result=await this.db.query<any>(
      "select id,email,status,source,created_at,updated_at from newsletter_subscribers where store_id=$1 order by created_at desc limit 1000",
      [storeId]
    );
    return {items:result.rows};
  }
}
