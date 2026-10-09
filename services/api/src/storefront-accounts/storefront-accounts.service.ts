import {BadRequestException,ConflictException,Injectable,NotFoundException,UnauthorizedException,ForbiddenException} from "@nestjs/common";
import {randomBytes,createHash,scrypt as nodeScrypt,timingSafeEqual} from "node:crypto";
import {promisify} from "node:util";
import {DatabaseService} from "../database/database.service";

const scrypt=promisify(nodeScrypt);
const digits=(value:string)=>value.replace(/\D/g,"");
const emailOf=(value:any)=>String(value||"").trim().toLowerCase();
const plain=(value:any,max=200)=>String(value??"").trim().slice(0,max);
type Identity={id:string;store_id:string;email:string;display_name:string;phone:string|null};

@Injectable()
export class StorefrontAccountsService{
  constructor(private readonly db:DatabaseService){}

  private async store(){
    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    const result=await this.db.query<{id:string}>("select id from stores where domain=$1 limit 1",[domain]);
    if(!result.rowCount) throw new NotFoundException("Store is not configured");
    return result.rows[0].id;
  }
  private digest(token:string){return createHash("sha256").update(token,"utf8").digest("hex");}
  private async passwordHash(password:string){
    const salt=randomBytes(16).toString("hex");
    const key=await scrypt(password,salt,64) as Buffer;
    return "scrypt$"+salt+"$"+key.toString("hex");
  }
  private async matches(password:string,encoded:string){
    const [kind,salt,key]=String(encoded||"").split("$");
    if(kind!=="scrypt"||!salt||!key||!/^[a-f\d]+$/i.test(key)) return false;
    const computed=await scrypt(password,salt,64) as Buffer;
    const expected=Buffer.from(key,"hex");
    return expected.length===computed.length&&timingSafeEqual(expected,computed);
  }
  private async createSession(client:any,account:Identity){
    const token=randomBytes(32).toString("base64url");
    await client.query(
      "insert into storefront_account_sessions(account_id,token_digest,expires_at) values($1,$2,now()+interval '14 days')",
      [account.id,this.digest(token)]
    );
    return {token,account:{id:account.id,email:account.email,name:account.display_name,phone:account.phone}};
  }
  async register(body:any){
    const storeId=await this.store();
    const email=emailOf(body?.email);
    const name=plain(body?.name,120);
    const password=String(body?.password||"");
    const phone=plain(body?.phone,40);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>250) throw new BadRequestException("Enter a valid email address");
    if(name.length<2) throw new BadRequestException("Enter your full name");
    if(password.length<12||password.length>128) throw new BadRequestException("Use a password between 12 and 128 characters");
    try{
      const hash=await this.passwordHash(password);
      return await this.db.transaction(async(client)=>{
        const created=await client.query<Identity>(
          "insert into storefront_accounts(store_id,email,password_hash,display_name,phone) values($1,$2,$3,$4,$5) returning id,store_id,email,display_name,phone",
          [storeId,email,hash,name,phone||null]
        );
        return this.createSession(client,created.rows[0]);
      });
    }catch(err:any){
      if(err?.code==="23505") throw new ConflictException("An account with this email already exists");
      throw err;
    }
  }
  async login(body:any){
    const storeId=await this.store();
    const email=emailOf(body?.email);
    const password=String(body?.password||"");
    if(!email||!password) throw new UnauthorizedException("Invalid email or password");
    const result=await this.db.query<Identity&{password_hash:string}>(
      "select id,store_id,email,display_name,phone,password_hash from storefront_accounts where store_id=$1 and email=$2",
      [storeId,email]
    );
    // Avoid an obvious account-existence timing oracle for unknown emails.
    const fake="scrypt$4f9373c7c7211a8902f089ea9d283b3c$"+Buffer.alloc(64).toString("hex");
    const verified=await this.matches(password,result.rows[0]?.password_hash||fake);
    if(!result.rowCount||!verified) throw new UnauthorizedException("Invalid email or password");
    const account=result.rows[0];
    return this.db.transaction(client=>this.createSession(client,account));
  }
  private async requireAccount(token?:string):Promise<Identity>{
    if(!token||token.length<25||token.length>200) throw new UnauthorizedException("Sign in to continue");
    const storeId=await this.store();
    const result=await this.db.query<Identity>(
      "select a.id,a.store_id,a.email,a.display_name,a.phone from storefront_account_sessions s join storefront_accounts a on a.id=s.account_id where s.token_digest=$1 and s.expires_at>now() and a.store_id=$2 limit 1",
      [this.digest(token),storeId]
    );
    if(!result.rowCount) throw new UnauthorizedException("Your session has expired. Sign in again");
    return result.rows[0];
  }
  async me(token?:string){
    const a=await this.requireAccount(token);
    return {id:a.id,email:a.email,name:a.display_name,phone:a.phone};
  }
  async logout(token?:string){
    if(token) await this.db.query("delete from storefront_account_sessions where token_digest=$1",[this.digest(token)]);
    return {ok:true};
  }
  async profile(token:string|undefined,body:any){
    const a=await this.requireAccount(token);
    const name=plain(body?.name,120);
    const phone=plain(body?.phone,40);
    if(name.length<2) throw new BadRequestException("Enter your full name");
    const changed=await this.db.query<Identity>(
      "update storefront_accounts set display_name=$1,phone=$2,updated_at=now() where id=$3 and store_id=$4 returning id,store_id,email,display_name,phone",
      [name,phone||null,a.id,a.store_id]
    );
    const row=changed.rows[0];
    return {id:row.id,email:row.email,name:row.display_name,phone:row.phone};
  }
  async addresses(token?:string){
    const a=await this.requireAccount(token);
    const result=await this.db.query<any>(
      "select id,label,recipient,phone,line1,line2,city,region,postal_code as \"postalCode\",country,is_default as \"isDefault\" from storefront_account_addresses where account_id=$1 order by is_default desc,created_at desc",
      [a.id]
    );
    return result.rows;
  }
  async saveAddress(token:string|undefined,body:any,id?:string){
    const a=await this.requireAccount(token);
    const label=plain(body?.label,35)||"Home",recipient=plain(body?.recipient,120);
    const phone=plain(body?.phone,40),line1=plain(body?.line1,200),line2=plain(body?.line2,200);
    const city=plain(body?.city,100),region=plain(body?.region,100),postal=plain(body?.postalCode,30);
    const country=plain(body?.country,80)||"Pakistan";
    if(!recipient||!line1||!city||!country) throw new BadRequestException("Recipient, address, city and country are required");
    return this.db.transaction(async client=>{
      await client.query("select id from storefront_accounts where id=$1 for update",[a.id]);
      const existing=await client.query<{id:string}>("select id from storefront_account_addresses where account_id=$1 order by created_at",[a.id]);
      if(!id&&existing.rowCount>=10) throw new BadRequestException("Maximum 10 saved addresses");
      if(id&&!existing.rows.some(row=>row.id===id)) throw new NotFoundException("Address not found");
      const isDefault=Boolean(body?.isDefault)||(!id&&existing.rowCount===0);
      if(isDefault) await client.query("update storefront_account_addresses set is_default=false where account_id=$1",[a.id]);
      const values=[label,recipient,phone||null,line1,line2,city,region,postal,country,isDefault,a.id];
      const result=id?await client.query<any>(
        "update storefront_account_addresses set label=$1,recipient=$2,phone=$3,line1=$4,line2=$5,city=$6,region=$7,postal_code=$8,country=$9,is_default=$10,updated_at=now() where account_id=$11 and id=$12 returning id",
        [...values,id]
      ):await client.query<any>(
        "insert into storefront_account_addresses(label,recipient,phone,line1,line2,city,region,postal_code,country,is_default,account_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id",values
      );
      return {ok:true,id:result.rows[0].id};
    });
  }
  async deleteAddress(token:string|undefined,id:string){
    const a=await this.requireAccount(token);
    const result=await this.db.query<any>("delete from storefront_account_addresses where id=$1 and account_id=$2 returning id",[id,a.id]);
    if(!result.rowCount) throw new NotFoundException("Address not found");
    return {ok:true};
  }
  async claimOrder(token:string|undefined,body:any){
    const a=await this.requireAccount(token);
    const orderNumber=plain(body?.orderNumber,80).toUpperCase();
    const phone=digits(String(body?.phone||""));
    if(!orderNumber||phone.length<10) throw new BadRequestException("Order number and original checkout phone are required");
    const found=await this.db.query<{id:string;phone:string}>(
      "select o.id,coalesce(c.phone,'') as phone from orders o join customers c on c.id=o.customer_id where o.store_id=$1 and upper(o.order_number)=$2 and lower(c.email)=$3 limit 1",
      [a.store_id,orderNumber,a.email]
    );
    const matched=found.rows[0];
    if(!matched||digits(matched.phone).slice(-10)!==phone.slice(-10)) throw new NotFoundException("No matching order found");
    const result=await this.db.query(
      "insert into storefront_account_orders(account_id,order_id) values($1,$2) on conflict(order_id) do nothing returning order_id",
      [a.id,matched.id]
    );
    if(!result.rowCount){
      const linked=await this.db.query<{account_id:string}>("select account_id from storefront_account_orders where order_id=$1",[matched.id]);
      if(linked.rows[0]?.account_id!==a.id) throw new ConflictException("Order is already linked to an account");
    }
    return {ok:true,orderNumber};
  }
  async orders(token?:string){
    const a=await this.requireAccount(token);
    const result=await this.db.query<any>(
      "select o.id,o.order_number as \"orderNumber\",o.status,o.payment_status as \"paymentStatus\",o.fulfillment_status as \"fulfillmentStatus\",o.total::numeric as total,o.currency,o.created_at as \"createdAt\",o.tracking_carrier as \"trackingCarrier\",o.tracking_number as \"trackingNumber\",o.tracking_url as \"trackingUrl\" from storefront_account_orders link join orders o on o.id=link.order_id where link.account_id=$1 and o.store_id=$2 order by o.created_at desc limit 100",
      [a.id,a.store_id]
    );
    return result.rows.map(row=>({...row,total:Number(row.total)}));
  }
  async publicReviews(handle:string){
    const storeId=await this.store();
    const product=await this.db.query<{id:string}>("select id from products where store_id=$1 and handle=$2 and status='active'",[storeId,handle]);
    if(!product.rowCount) throw new NotFoundException("Product not found");
    const stats=await this.db.query<{count:number;average:number}>(
      "select count(*)::int as count,coalesce(round(avg(rating)::numeric,1),0) as average from storefront_product_reviews where product_id=$1 and status='published'",
      [product.rows[0].id]
    );
    const reviews=await this.db.query<any>(
      "select r.id,r.rating,r.title,r.body,r.created_at as \"createdAt\",r.verified_purchase as \"verifiedPurchase\",split_part(a.display_name,' ',1) as author from storefront_product_reviews r join storefront_accounts a on a.id=r.account_id where r.product_id=$1 and r.status='published' order by r.created_at desc limit 50",
      [product.rows[0].id]
    );
    return {average:Number(stats.rows[0].average),count:Number(stats.rows[0].count),items:reviews.rows};
  }
  async postReview(token:string|undefined,handle:string,body:any){
    const a=await this.requireAccount(token);
    const rating=Number(body?.rating);
    const title=plain(body?.title,120);
    const text=plain(body?.body,1200);
    if(!Number.isInteger(rating)||rating<1||rating>5) throw new BadRequestException("Rating must be 1–5 stars");
    if(title.length<3||text.length<15) throw new BadRequestException("A title and at least 15 characters of feedback are required");
    const product=await this.db.query<{id:string}>("select id from products where store_id=$1 and handle=$2 and status='active'",[a.store_id,handle]);
    if(!product.rowCount) throw new NotFoundException("Product not found");
    const productId=product.rows[0].id;
    const owned=await this.db.query(
      "select 1 from storefront_account_orders l join orders o on o.id=l.order_id join order_items oi on oi.order_id=o.id where l.account_id=$1 and o.store_id=$2 and oi.product_id=$3 and o.status<>'canceled' limit 1",
      [a.id,a.store_id,productId]
    );
    if(!owned.rowCount) throw new ForbiddenException("Link a completed purchase to review this product");
    const result=await this.db.query<any>(
      "insert into storefront_product_reviews(store_id,product_id,account_id,rating,title,body,status,verified_purchase) values($1,$2,$3,$4,$5,$6,'published',true) on conflict(product_id,account_id) do update set rating=excluded.rating,title=excluded.title,body=excluded.body,updated_at=now() returning id,rating,title,body",
      [a.store_id,productId,a.id,rating,title,text]
    );
    return {ok:true,review:result.rows[0]};
  }
}
