import {BadRequestException,Injectable,NotFoundException} from "@nestjs/common";
import type {PoolClient} from "pg";
import {DatabaseService} from "../database/database.service";
import {StoreContextService} from "./store-context.service";

type Queryable={query:(text:string,params?:any[])=>Promise<any>};

@Injectable()
export class GovernanceService{
  constructor(private readonly db:DatabaseService,private readonly context:StoreContextService){}

  async audit(
    storeId:string,
    action:string,
    resourceType:string,
    resourceId:string|null,
    options:{actor?:string;actorType?:string;before?:any;after?:any;metadata?:any}={},
    client?:PoolClient,
  ){
    const q:Queryable=client??this.db;
    await q.query(
      "insert into audit_logs(store_id,actor,actor_type,action,resource_type,resource_id,before_data,after_data,metadata) values($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb)",
      [storeId,String(options.actor||"admin"),String(options.actorType||"admin"),action,resourceType,resourceId,JSON.stringify(options.before??null),JSON.stringify(options.after??null),JSON.stringify(options.metadata||{})]
    );
  }

  async notify(
    storeId:string,
    input:{type:string;title:string;body?:string;severity?:string;resourceType?:string;resourceId?:string|null;channels?:string[];metadata?:any},
    client?:PoolClient,
  ){
    const q:Queryable=client??this.db;
    const result=await q.query(
      "insert into notifications(store_id,notification_type,title,body,severity,resource_type,resource_id,channels,metadata) values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) returning *",
      [storeId,input.type,input.title,input.body||null,input.severity||"info",input.resourceType||null,input.resourceId||null,input.channels||["admin"],JSON.stringify(input.metadata||{})]
    );
    return result.rows[0];
  }

  async enqueueMessage(
    storeId:string,
    input:{channel:string;recipient:string;templateKey:string;subject?:string;payload?:any;provider?:string|null},
    client?:PoolClient,
  ){
    const q:Queryable=client??this.db;
    const recipient=String(input.recipient||"").trim();
    if(!recipient) throw new BadRequestException("Message recipient is required");
    const result=await q.query(
      "insert into outbound_messages(store_id,channel,recipient,template_key,subject,payload,provider) values($1,$2,$3,$4,$5,$6::jsonb,$7) returning *",
      [storeId,input.channel,recipient,input.templateKey,input.subject||null,JSON.stringify(input.payload||{}),input.provider||null]
    );
    return result.rows[0];
  }

  async logs(limit=200){
    const storeId=await this.context.storeId();
    const safe=Math.min(500,Math.max(1,Number(limit||200)));
    const result=await this.db.query<any>("select * from audit_logs where store_id=$1 order by created_at desc limit $2",[storeId,safe]);
    return {items:result.rows};
  }

  async notifications(status?:string){
    const storeId=await this.context.storeId();
    const result=status
      ?await this.db.query<any>("select * from notifications where store_id=$1 and status=$2 order by created_at desc limit 250",[storeId,status])
      :await this.db.query<any>("select * from notifications where store_id=$1 order by created_at desc limit 250",[storeId]);
    return {items:result.rows};
  }

  async markNotification(id:string,status="read"){
    const storeId=await this.context.storeId();
    if(!["unread","read","archived"].includes(status)) throw new BadRequestException("Invalid notification status");
    const result=await this.db.query<any>(
      "update notifications set status=$1,read_at=case when $1='read' then coalesce(read_at,now()) else read_at end where id=$2 and store_id=$3 returning *",
      [status,id,storeId]
    );
    if(!result.rowCount) throw new NotFoundException("Notification not found");
    return result.rows[0];
  }

  async roles(){
    const storeId=await this.context.storeId();
    const roles=await this.db.query<any>("select * from roles where store_id=$1 order by system_role desc,name",[storeId]);
    const users=await this.db.query<any>(
      "select u.id,u.email,u.display_name,u.status,u.last_seen_at,u.created_at,r.name as role_name,r.slug as role_slug,r.permissions from admin_users u left join roles r on r.id=u.role_id where u.store_id=$1 order by u.created_at",
      [storeId]
    );
    return {roles:roles.rows,users:users.rows,currentAuthMode:"single-owner-basic",rbacReady:true};
  }

  async createRole(body:any){
    const storeId=await this.context.storeId();
    const name=String(body?.name||"").trim();
    const slug=String(body?.slug||"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    const permissions=Array.isArray(body?.permissions)?body.permissions.map(String).filter(Boolean):[];
    if(!name||!slug) throw new BadRequestException("Role name and slug are required");
    const result=await this.db.query<any>(
      "insert into roles(store_id,name,slug,permissions,system_role) values($1,$2,$3,$4,false) returning *",
      [storeId,name,slug,permissions]
    );
    await this.audit(storeId,"role.created","role",result.rows[0].id,{after:result.rows[0]});
    return result.rows[0];
  }

  async outbox(){
    const storeId=await this.context.storeId();
    const result=await this.db.query<any>("select * from outbound_messages where store_id=$1 order by created_at desc limit 250",[storeId]);
    return {items:result.rows,providerConfigured:Boolean(process.env.EMAIL_PROVIDER_API_KEY||process.env.GMAIL_CLIENT_ID||process.env.WHATSAPP_ACCESS_TOKEN)};
  }
}
