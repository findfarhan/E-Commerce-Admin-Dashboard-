import {BadRequestException,Injectable,NotFoundException,UnauthorizedException} from "@nestjs/common";
import {createHmac,randomBytes,scryptSync,timingSafeEqual} from "node:crypto";
import {DatabaseService} from "../database/database.service";

@Injectable()
export class AuthService{
  constructor(private readonly db:DatabaseService){}
  private async storeId(){
    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    const r=await this.db.query<{id:string}>("select id from stores where domain=$1 limit 1",[domain]);
    if(!r.rowCount) throw new NotFoundException("Store is not configured");
    return r.rows[0].id;
  }
  private secret(){
    const s=process.env.ADMIN_SESSION_SECRET||process.env.ADMIN_API_KEY;
    if(!s) throw new Error("ADMIN_SESSION_SECRET or ADMIN_API_KEY must be configured");
    return s;
  }
  private hashPassword(password:string){
    const salt=randomBytes(16).toString("hex");
    const hash=scryptSync(password,salt,64).toString("hex");
    return "scrypt$"+salt+"$"+hash;
  }
  private verifyPassword(password:string,encoded:string){
    const [kind,salt,hex]=String(encoded||"").split("$");
    if(kind!=="scrypt"||!salt||!hex) return false;
    const actual=scryptSync(password,salt,64);
    const expected=Buffer.from(hex,"hex");
    return actual.length===expected.length&&timingSafeEqual(actual,expected);
  }
  private sign(payload:any){
    const body=Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig=createHmac("sha256",this.secret()).update(body).digest("base64url");
    return body+"."+sig;
  }
  private async permissions(userId:string){
    const r=await this.db.query<any>("select r.id,r.name,r.permissions from admin_roles r join admin_user_roles ur on ur.role_id=r.id where ur.user_id=$1 order by r.name",[userId]);
    const permissions=[...new Set(r.rows.flatMap((x:any)=>x.permissions||[]))];
    return {roles:r.rows.map((x:any)=>({id:x.id,name:x.name})),permissions};
  }
  async login(body:any){
    const storeId=await this.storeId();
    const email=String(body?.email||"").trim().toLowerCase(),password=String(body?.password||"");
    if(!email||!password) throw new UnauthorizedException("Invalid credentials");
    const r=await this.db.query<any>("select * from admin_users where store_id=$1 and lower(email)=lower($2) and status='active' limit 1",[storeId,email]);
    const user=r.rows[0];
    if(!user||!user.password_hash||!this.verifyPassword(password,user.password_hash)) throw new UnauthorizedException("Invalid credentials");
    const access=await this.permissions(user.id);
    const now=Math.floor(Date.now()/1000),exp=now+8*60*60;
    await this.db.query("update admin_users set last_seen_at=now() where id=$1",[user.id]);
    return {token:this.sign({sub:user.id,email:user.email,name:user.name,permissions:access.permissions,roles:access.roles.map(x=>x.name),iat:now,exp}),expiresAt:new Date(exp*1000).toISOString(),user:{id:user.id,email:user.email,name:user.name,roles:access.roles,permissions:access.permissions}};
  }
  async roles(){
    const storeId=await this.storeId();
    const r=await this.db.query<any>("select id,name,permissions,created_at from admin_roles where store_id=$1 order by case name when 'Owner' then 0 when 'Manager' then 1 else 2 end,name",[storeId]);
    return {items:r.rows};
  }
  async users(){
    const storeId=await this.storeId();
    const r=await this.db.query<any>("select u.id,u.email,u.name,u.status,u.last_seen_at,u.created_at,coalesce(json_agg(json_build_object('id',r.id,'name',r.name,'permissions',r.permissions)) filter(where r.id is not null),'[]') roles from admin_users u left join admin_user_roles ur on ur.user_id=u.id left join admin_roles r on r.id=ur.role_id where u.store_id=$1 group by u.id order by u.created_at",[storeId]);
    return {items:r.rows};
  }
  async createUser(body:any){
    const storeId=await this.storeId();
    const email=String(body?.email||"").trim().toLowerCase(),name=String(body?.name||"").trim(),password=String(body?.password||"");
    const roleIds=Array.isArray(body?.roleIds)?body.roleIds.map(String):[];
    if(!email.includes("@")||!name||password.length<10||!roleIds.length) throw new BadRequestException("Name, valid email, password (10+ chars), and at least one role are required");
    return this.db.transaction(async c=>{
      const valid=await c.query<any>("select id from admin_roles where store_id=$1 and id=any($2::uuid[])",[storeId,roleIds]);
      if(valid.rowCount!==new Set(roleIds).size) throw new BadRequestException("Invalid role selection");
      const u=await c.query<any>("insert into admin_users(store_id,email,name,password_hash,status) values($1,$2,$3,$4,'active') returning id,email,name,status,created_at",[storeId,email,name,this.hashPassword(password)]);
      for(const roleId of roleIds) await c.query("insert into admin_user_roles(user_id,role_id) values($1,$2)",[u.rows[0].id,roleId]);
      return {...u.rows[0],roles:valid.rows};
    });
  }
  async updateUser(id:string,body:any){
    const storeId=await this.storeId();
    return this.db.transaction(async c=>{
      const current=await c.query<any>("select * from admin_users where id=$1 and store_id=$2 for update",[id,storeId]);
      if(!current.rowCount) throw new NotFoundException("Staff user not found");
      const status=body?.status!==undefined?String(body.status):current.rows[0].status;
      if(!["active","disabled"].includes(status)) throw new BadRequestException("Invalid user status");
      const name=body?.name!==undefined?String(body.name).trim():current.rows[0].name;
      const password=String(body?.password||"");
      const passwordHash=password?this.hashPassword(password):current.rows[0].password_hash;
      await c.query("update admin_users set name=$1,status=$2,password_hash=$3,updated_at=now() where id=$4",[name,status,passwordHash,id]);
      if(Array.isArray(body?.roleIds)){
        const roleIds=body.roleIds.map(String);
        const valid=await c.query<any>("select id from admin_roles where store_id=$1 and id=any($2::uuid[])",[storeId,roleIds]);
        if(valid.rowCount!==new Set(roleIds).size) throw new BadRequestException("Invalid roles");
        await c.query("delete from admin_user_roles where user_id=$1",[id]);
        for(const roleId of roleIds) await c.query("insert into admin_user_roles(user_id,role_id) values($1,$2)",[id,roleId]);
      }
      return (await this.users()).items.find((x:any)=>x.id===id);
    });
  }
}
