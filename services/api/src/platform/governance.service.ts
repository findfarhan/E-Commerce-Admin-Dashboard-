import {BadRequestException,ConflictException,Injectable,NotFoundException,UnauthorizedException} from "@nestjs/common";
import {pbkdf2Sync,randomBytes,timingSafeEqual} from "node:crypto";
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


  private password(password:string,salt?:string,iterations=210000){
    if(password.length<10) throw new BadRequestException("Admin passwords must be at least 10 characters");
    const actualSalt=salt||randomBytes(18).toString("hex");
    const hash=pbkdf2Sync(password,actualSalt,iterations,32,"sha256").toString("hex");
    return {hash,salt:actualSalt,iterations};
  }

  async bootstrapAdmin(body:any){
    const storeId=await this.context.storeId();
    const count=await this.db.query<any>("select count(*)::int as count from admin_users where store_id=$1",[storeId]);
    if(Number(count.rows[0]?.count||0)>0) throw new ConflictException("Admin users are already configured");
    const email=String(body?.email||body?.username||"").trim().toLowerCase();
    const password=String(body?.password||"");
    if(!email) throw new BadRequestException("Admin username or email is required");
    const credential=this.password(password);
    const role=await this.db.query<any>("select id from roles where store_id=$1 and slug='owner' limit 1",[storeId]);
    if(!role.rowCount) throw new NotFoundException("Owner role is not configured");
    const result=await this.db.query<any>(
      "insert into admin_users(store_id,email,display_name,role_id,password_hash,password_salt,password_iterations,status,last_login_at,created_by) values($1,$2,$3,$4,$5,$6,$7,'active',now(),'bootstrap') returning id,email,display_name,role_id,status,created_at",
      [storeId,email,String(body?.displayName||"Owner").trim()||"Owner",role.rows[0].id,credential.hash,credential.salt,credential.iterations]
    );
    await this.audit(storeId,"admin_user.bootstrapped","admin_user",result.rows[0].id,{actor:email,after:result.rows[0]});
    return result.rows[0];
  }

  async login(body:any){
    const storeId=await this.context.storeId();
    const email=String(body?.email||body?.username||"").trim().toLowerCase();
    const password=String(body?.password||"");
    if(!email||!password) throw new UnauthorizedException("Invalid credentials");
    const result=await this.db.query<any>(
      "select u.*,r.name as role_name,r.slug as role_slug,r.permissions from admin_users u left join roles r on r.id=u.role_id where u.store_id=$1 and lower(u.email)=$2 limit 1",
      [storeId,email]
    );
    if(!result.rowCount||result.rows[0].status!=="active"||!result.rows[0].password_hash||!result.rows[0].password_salt) throw new UnauthorizedException("Invalid credentials");
    const user=result.rows[0];
    const candidate=this.password(password,user.password_salt,Number(user.password_iterations||210000)).hash;
    const expected=Buffer.from(String(user.password_hash),"hex");
    const actual=Buffer.from(candidate,"hex");
    if(expected.length!==actual.length||!timingSafeEqual(expected,actual)) throw new UnauthorizedException("Invalid credentials");
    await this.db.query("update admin_users set last_login_at=now(),last_seen_at=now(),updated_at=now() where id=$1",[user.id]);
    return {id:user.id,email:user.email,displayName:user.display_name||user.email,role:{id:user.role_id,name:user.role_name,slug:user.role_slug,permissions:user.permissions||[]}};
  }

  async createAdminUser(body:any){
    const storeId=await this.context.storeId();
    const email=String(body?.email||"").trim().toLowerCase();
    if(!email||!email.includes("@")) throw new BadRequestException("A valid admin email is required");
    const role=await this.db.query<any>("select * from roles where id=$1 and store_id=$2",[String(body?.roleId||""),storeId]);
    if(!role.rowCount) throw new BadRequestException("Role is invalid");
    const password=String(body?.password||"");
    const credential=password?this.password(password):null;
    const status=credential?"active":"invited";
    const result=await this.db.query<any>(
      "insert into admin_users(store_id,email,display_name,role_id,password_hash,password_salt,password_iterations,status,invited_at,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,case when $8='invited' then now() else null end,$9) returning id,email,display_name,role_id,status,created_at",
      [storeId,email,String(body?.displayName||"").trim()||null,role.rows[0].id,credential?.hash||null,credential?.salt||null,credential?.iterations||210000,status,String(body?.actor||"admin")]
    );
    await this.audit(storeId,"admin_user.created","admin_user",result.rows[0].id,{actor:body?.actor,after:result.rows[0],metadata:{role:role.rows[0].slug}});
    return result.rows[0];
  }

  async updateAdminUser(id:string,body:any){
    const storeId=await this.context.storeId();
    const current=await this.db.query<any>("select * from admin_users where id=$1 and store_id=$2",[id,storeId]);
    if(!current.rowCount) throw new NotFoundException("Admin user not found");
    let roleId=current.rows[0].role_id;
    if(body?.roleId!==undefined){
      const role=await this.db.query<any>("select id from roles where id=$1 and store_id=$2",[String(body.roleId),storeId]);
      if(!role.rowCount) throw new BadRequestException("Role is invalid");
      roleId=role.rows[0].id;
    }
    const status=body?.status===undefined?current.rows[0].status:String(body.status);
    if(!["invited","active","suspended"].includes(status)) throw new BadRequestException("Invalid admin status");
    let hash=current.rows[0].password_hash,salt=current.rows[0].password_salt,iterations=current.rows[0].password_iterations;
    if(body?.password){
      const credential=this.password(String(body.password));
      hash=credential.hash;salt=credential.salt;iterations=credential.iterations;
    }
    const result=await this.db.query<any>(
      "update admin_users set display_name=$1,role_id=$2,password_hash=$3,password_salt=$4,password_iterations=$5,status=$6,updated_at=now() where id=$7 and store_id=$8 returning id,email,display_name,role_id,status,updated_at",
      [body?.displayName===undefined?current.rows[0].display_name:String(body.displayName||"").trim()||null,roleId,hash,salt,iterations,status,id,storeId]
    );
    await this.audit(storeId,"admin_user.updated","admin_user",id,{actor:body?.actor,before:current.rows[0],after:result.rows[0]});
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
