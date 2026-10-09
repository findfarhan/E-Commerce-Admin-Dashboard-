import {BadRequestException,ConflictException,Injectable,Logger,NotFoundException,ServiceUnavailableException} from "@nestjs/common";
import {Interval} from "@nestjs/schedule";
import {createHmac,timingSafeEqual} from "node:crypto";
import {DatabaseService} from "../database/database.service";
import {CheckoutService} from "../checkout/checkout.service";

const validUuid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const STEPS=[1,24,72];
const HORIZON_MS=7*86400_000;

@Injectable()
export class RecoveryService {
 private readonly log=new Logger(RecoveryService.name);
 private running=false;
 constructor(private readonly db:DatabaseService,private readonly checkout:CheckoutService){}
 private async store(){
  const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
  const row=await this.db.query<{id:string}>("select id from stores where domain=$1 limit 1",[domain]);
  if(!row.rowCount)throw new NotFoundException("Store not configured");
  return row.rows[0].id;
 }
 private secret(){return process.env.RECOVERY_SIGNING_SECRET||"";}
 private signature(purpose:"recover"|"unsubscribe",id:string,email:string){
  if(!this.secret()||this.secret().length<32)throw new ServiceUnavailableException("Recovery signatures are not configured");
  return createHmac("sha256",this.secret()).update(purpose+"\n"+id+"\n"+email.trim().toLowerCase()).digest("hex");
 }
 private verify(expected:string,actual:string){
  if(!/^[0-9a-f]{64}$/.test(actual))return false;
  return timingSafeEqual(Buffer.from(expected,"hex"),Buffer.from(actual,"hex"));
 }
 private emailDigest(email:string){return createHmac("sha256",this.secret()).update("optout\n"+email.trim().toLowerCase()).digest("hex");}
 private async row(id:string){
  if(!validUuid(id))throw new BadRequestException("Invalid checkout");
  const storeId=await this.store();
  const r=await this.db.query<any>("select cr.*,c.status as checkout_status,c.created_at as checkout_created_at from checkout_recoveries cr join checkout_sessions c on c.id=cr.checkout_id where cr.checkout_id=$1 and cr.store_id=$2 limit 1",[id,storeId]);
  if(!r.rowCount)throw new NotFoundException("Recovery unavailable");
  return r.rows[0];
 }
 async unsubscribe(id:string,token:string){
  const record=await this.row(id);
  if(!this.verify(this.signature("unsubscribe",id,record.email_snapshot),token))throw new BadRequestException("Invalid unsubscribe link");
  const digest=this.emailDigest(record.email_snapshot);
  await this.db.transaction(async client=>{
    await client.query("insert into checkout_recovery_optouts(store_id,email_digest) values($1,$2) on conflict do nothing",[record.store_id,digest]);
    await client.query("update checkout_recoveries set status='suppressed',next_send_at=null,updated_at=now() where store_id=$1 and email_snapshot=$2 and status='pending'",[record.store_id,record.email_snapshot]);
  });
  return {ok:true,message:"You will not receive further checkout recovery reminders."};
 }
 async redeem(id:string,token:string){
  const record=await this.row(id);
  if(!this.verify(this.signature("recover",id,record.email_snapshot),token))throw new BadRequestException("Invalid recovery link");
  if(record.status!=="pending"||record.checkout_status==="completed")throw new ConflictException("This checkout is no longer recoverable");
  if(Date.now()-new Date(record.consent_at).getTime()>HORIZON_MS)throw new ConflictException("Recovery link expired");
  const optedOut=await this.db.query("select 1 from checkout_recovery_optouts where store_id=$1 and email_digest=$2",[record.store_id,this.emailDigest(record.email_snapshot)]);
  if(optedOut.rowCount)throw new ConflictException("Recovery link is disabled");
  if(record.recovered_checkout_id){
    const previously=await this.db.query<any>("select id,status,expires_at from checkout_sessions where id=$1 and store_id=$2",[record.recovered_checkout_id,record.store_id]);
    if(previously.rowCount&&previously.rows[0].status==="open"&&new Date(previously.rows[0].expires_at).getTime()>Date.now())
      return {ok:true,checkoutId:previously.rows[0].id};
  }
  // Rebuild a NEW checkout from actual variant IDs; never trust saved prices,
  // expired cart totals, delivery rates, coupons or unavailable bundle offers.
  const components=await this.db.query<{variant_id:string;quantity:number}>("select variant_id,quantity from checkout_lines where checkout_id=$1 order by id",[id]);
  if(!components.rowCount)throw new ConflictException("No jewelry remains in this checkout");
  const bundles=await this.db.query<any>("select bundle_id,quantity from checkout_bundle_allocations where checkout_id=$1",[id]);
  const bundledVariants=new Map<string,number>();
  if(bundles.rowCount){
    const snapshots=await this.db.query<any>("select quantity,component_snapshot from checkout_bundle_allocations where checkout_id=$1",[id]);
    for(const b of snapshots.rows)for(const c of b.component_snapshot||[]){
      const key=String(c.variantId);
      bundledVariants.set(key,(bundledVariants.get(key)||0)+Number(c.quantity)*Number(b.quantity));
    }
  }
  const regular=components.rows.map(c=>({variantId:c.variant_id,quantity:Number(c.quantity)-(bundledVariants.get(c.variant_id)||0)})).filter(c=>c.quantity>0);
  const rebuilt=await this.checkout.create({items:regular,bundles:bundles.rows.map((b:any)=>({bundleId:b.bundle_id,quantity:Number(b.quantity)}))});
  await this.db.transaction(async client=>{
    const current=await client.query<any>("select status,recovered_checkout_id from checkout_recoveries where checkout_id=$1 and store_id=$2 for update",[id,record.store_id]);
    if(current.rows[0]?.status!=="pending")throw new ConflictException("Checkout no longer recoverable");
    await client.query("update checkout_sessions set recovered_from_checkout_id=$1 where id=$2 and store_id=$3",[id,rebuilt.id,record.store_id]);
    await client.query("update checkout_recoveries set recovered_checkout_id=$1,updated_at=now() where checkout_id=$2",[rebuilt.id,id]);
  });
  return {ok:true,checkoutId:rebuilt.id};
 }
 async dashboard(){
  const storeId=await this.store();
  const [totals,rows,steps]=await Promise.all([
    this.db.query<any>("select count(*)::int total,count(*) filter(where status='pending')::int pending,count(*) filter(where status='recovered')::int recovered,count(*) filter(where status='suppressed')::int suppressed,coalesce(sum(o.total) filter(where cr.status='recovered'),0) recovered_value from checkout_recoveries cr left join orders o on o.id=cr.recovered_order_id where cr.store_id=$1 and cr.created_at>=now()-interval '30 days'",[storeId]),
    this.db.query<any>("select cr.checkout_id,cr.email_snapshot,cr.consent_at,cr.status,cr.send_step,cr.next_send_at,cr.last_sent_at,cr.updated_at,c.subtotal,c.total,c.expires_at from checkout_recoveries cr join checkout_sessions c on c.id=cr.checkout_id where cr.store_id=$1 order by cr.created_at desc limit 150",[storeId]),
    this.db.query<any>("select step,status,count(*)::int count from checkout_recovery_attempts where store_id=$1 and attempted_at>=now()-interval '30 days' group by step,status order by step,status",[storeId])
  ]);
  const summary=totals.rows[0];
  return {summary:{total:Number(summary.total||0),pending:Number(summary.pending||0),recovered:Number(summary.recovered||0),suppressed:Number(summary.suppressed||0),recoveredValue:Number(summary.recovered_value||0),deliveryEnabled:this.enabled()},items:rows.rows.map(x=>({...x,subtotal:Number(x.subtotal),total:Number(x.total)})),steps:steps.rows};
 }
 private enabled(){return process.env.RECOVERY_EMAIL_ENABLED==="true"&&Boolean(process.env.RESEND_API_KEY&&process.env.RECOVERY_FROM_EMAIL&&this.secret().length>=32);}
 @Interval(900000)
 async runRecovery(){
  if(this.running||!this.enabled()||!this.db.isConfigured())return;
  this.running=true;
  try {
   // Durable claim with unique(checkout_id,step) across concurrent workers.
   const storeId=await this.store();
   for(let i=0;i<10;i++){
    const due=await this.db.transaction(async client=>{
      const result=await client.query<any>("select cr.*,c.status as checkout_status,c.customer_email from checkout_recoveries cr join checkout_sessions c on c.id=cr.checkout_id where cr.store_id=$1 and cr.status='pending' and cr.send_step<3 and cr.next_send_at<=now() and cr.consent_at>now()-interval '7 days' order by cr.next_send_at for update of cr skip locked limit 1",[storeId]);
      if(!result.rowCount)return null;
      const row=result.rows[0],step=Number(row.send_step)+1;
      if(row.checkout_status==="completed"||row.customer_email!==row.email_snapshot){
        await client.query("update checkout_recoveries set status='suppressed',next_send_at=null,updated_at=now() where checkout_id=$1",[row.checkout_id]);
        return {skipped:true};
      }
      const digest=this.emailDigest(row.email_snapshot);
      const blocked=await client.query("select 1 from checkout_recovery_optouts where store_id=$1 and email_digest=$2",[row.store_id,digest]);
      if(blocked.rowCount){
        await client.query("update checkout_recoveries set status='suppressed',next_send_at=null,updated_at=now() where checkout_id=$1",[row.checkout_id]);
        return {skipped:true};
      }
      const claim=await client.query<any>("insert into checkout_recovery_attempts(store_id,checkout_id,step,status) values($1,$2,$3,'claimed') on conflict(checkout_id,step) do nothing returning id",[row.store_id,row.checkout_id,step]);
      if(!claim.rowCount){
        await client.query("update checkout_recoveries set next_send_at=now()+interval '30 minutes' where checkout_id=$1",[row.checkout_id]);
        return {skipped:true};
      }
      await client.query("update checkout_recoveries set next_send_at=now()+interval '30 minutes',updated_at=now() where checkout_id=$1",[row.checkout_id]);
      return {...row,step,attemptId:claim.rows[0].id};
    });
    if(!due)break;
    if(due.skipped)continue;
    try{
      const storefront=(process.env.RECOVERY_STOREFRONT_URL||"https://jewelry-store-lime.vercel.app").replace(/\/$/,"");
      const link=storefront+"/recover?checkout="+encodeURIComponent(due.checkout_id)+"&token="+this.signature("recover",due.checkout_id,due.email_snapshot);
      const unsub=storefront+"/recovery-unsubscribe?checkout="+encodeURIComponent(due.checkout_id)+"&token="+this.signature("unsubscribe",due.checkout_id,due.email_snapshot);
      const result=await fetch("https://api.resend.com/emails",{
        method:"POST",
        headers:{"Authorization":"Bearer "+process.env.RESEND_API_KEY,"Content-Type":"application/json","Idempotency-Key":"jewelry-recovery-"+due.checkout_id+"-"+due.step},
        body:JSON.stringify({from:process.env.RECOVERY_FROM_EMAIL,to:[due.email_snapshot],subject:due.step===1?"You left something in your jewelry bag":"Your jewelry selection is still here",
        text:"You asked us to send checkout reminders. If you still want your jewelry, review current availability and prices here:\n"+link+"\n\nPrices and stock may change.\nStop these reminders: "+unsub}),
        signal:AbortSignal.timeout(15000)
      });
      if(!result.ok)throw new Error("Email provider rejected request ("+result.status+")");
      const provider=await result.json() as {id?:string};
      await this.db.transaction(async client=>{
        await client.query("update checkout_recovery_attempts set status='sent',completed_at=now(),provider_message_id=$1 where id=$2",[provider.id||null,due.attemptId]);
        await client.query("update checkout_recoveries set send_step=$1,last_sent_at=now(),last_error=null,next_send_at=case when $1>=3 then null else consent_at+($2::int * interval '1 hour') end,updated_at=now() where checkout_id=$3 and status='pending'",[due.step,STEPS[due.step]||72,due.checkout_id]);
      });
    }catch(error){
      this.log.warn("Recovery delivery failed: "+(error instanceof Error?error.message:"provider error"));
      await this.db.transaction(async client=>{
        await client.query("update checkout_recovery_attempts set status='failed',error_text=$1,completed_at=now() where id=$2",[(error instanceof Error?error.message:"Provider error").slice(0,300),due.attemptId]);
        // Advance step only after provider success? Failed steps remain operator-reviewable.
        // Do not auto-retry a potentially accepted email with a different idempotency key.
        await client.query("update checkout_recoveries set next_send_at=null,last_error='Delivery failed; manual review required',updated_at=now() where checkout_id=$1",[due.checkout_id]);
      });
    }
   }
  }catch(error){this.log.error(error);}finally{this.running=false;}
 }
}
