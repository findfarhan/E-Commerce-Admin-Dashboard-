import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException,UnauthorizedException} from "@nestjs/common";
import {createHash,randomBytes} from "node:crypto";
import {DatabaseService} from "../database/database.service";
import type {PoolClient} from "pg";
import {StorefrontAccountsService} from "../storefront-accounts/storefront-accounts.service";

const clean=(value:any,max=240)=>String(value??"").trim().slice(0,max);
const uuid=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const money=(value:any)=>Math.round((Number(value)||0)*100)/100;
const methods=["bank","jazzcash","easypaisa"];

@Injectable()
export class AffiliatesService{
  constructor(private readonly db:DatabaseService,private readonly accounts:StorefrontAccountsService){}
  private async store(){
    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    const r=await this.db.query<{id:string;currency:string}>("select id,currency from stores where domain=$1 limit 1",[domain]);
    if(!r.rowCount)throw new NotFoundException("Store not configured");
    return r.rows[0];
  }
  private async identity(token?:string){
    if(!token)throw new UnauthorizedException("Sign in to continue");
    return this.accounts.me(token);
  }
  private hash(v:string){return createHash("sha256").update(v).digest("hex");}
  private mask(v:string){return "•••• "+String(v||"").replace(/\s/g,"").slice(-4);}
  private async settings(storeId:string){
    const r=await this.db.query<any>("select enabled,default_rate,cookie_days,hold_days,min_payout from affiliate_program_settings where store_id=$1",[storeId]);
    return r.rows[0]||{enabled:false,default_rate:10,cookie_days:30,hold_days:14,min_payout:2000};
  }
  async program(){
    const s=await this.store(),p=await this.settings(s.id);
    return {enabled:Boolean(p.enabled),defaultRate:Number(p.default_rate),cookieDays:Number(p.cookie_days),holdDays:Number(p.hold_days),minPayout:Number(p.min_payout),currency:s.currency||"PKR"};
  }
  async apply(token:string|undefined,body:any){
    const a=await this.identity(token),store=await this.store(),program=await this.settings(store.id);
    if(!program.enabled)throw new ForbiddenException("Applications are not open yet");
    const channelName=clean(body?.channelName,120),channelUrl=clean(body?.channelUrl,300),notes=clean(body?.notes,900);
    if(channelName.length<3)throw new BadRequestException("Provide your channel or community name");
    if(channelUrl){
      try{const url=new URL(channelUrl);if(!["http:","https:"].includes(url.protocol))throw new Error("protocol");}
      catch{throw new BadRequestException("Valid http(s) channel URL is required");}
    }
    const found=await this.db.query<any>("select id,status,code from affiliates where store_id=$1 and account_id=$2",[store.id,a.id]);
    if(found.rowCount){
      const prior=found.rows[0];
      if(prior.status==="rejected"){
        await this.db.query("update affiliates set status='pending',channel_name=$1,channel_url=$2,notes=$3,updated_at=now(),reviewed_at=null where id=$4",[channelName,channelUrl||null,notes||null,prior.id]);
        return {ok:true,status:"pending",code:prior.code};
      }
      return {ok:true,status:prior.status,code:prior.code};
    }
    for(let i=0;i<4;i++){
      const code=("JS"+randomBytes(5).toString("hex")).toUpperCase();
      try{
        const c=await this.db.query<any>("insert into affiliates(store_id,account_id,code,rate,channel_name,channel_url,notes) values($1,$2,$3,$4,$5,$6,$7) returning code,status",[store.id,a.id,code,Number(program.default_rate),channelName,channelUrl||null,notes||null]);
        return {ok:true,...c.rows[0]};
      }catch(e:any){
        if(e?.code!=="23505")throw e;
        const retry=await this.db.query<any>("select code,status from affiliates where store_id=$1 and account_id=$2",[store.id,a.id]);
        if(retry.rowCount)return {ok:true,...retry.rows[0]};
      }
    }
    throw new ConflictException("Could not generate a referral code");
  }
  async dashboard(token?:string){
    const a=await this.identity(token),s=await this.store(),program=await this.program();
    const r=await this.db.query<any>("select * from affiliates where store_id=$1 and account_id=$2",[s.id,a.id]);
    if(!r.rowCount)return {program,application:null,stats:null,commissions:[],payouts:[]};
    const aff=r.rows[0];
    const [clicks,aggregated,commissions,payouts]=await Promise.all([
      this.db.query<any>("select count(*)::int n from affiliate_visits where affiliate_id=$1",[aff.id]),
      this.db.query<any>("select count(*)::int orders,coalesce(sum(amount) filter(where status='pending'),0) pending,coalesce(sum(amount) filter(where status='approved'),0) approved,coalesce(sum(amount) filter(where status='paid'),0) paid,coalesce(sum(amount) filter(where status='reversal_due'),0) reversal_due from affiliate_commissions where affiliate_id=$1",[aff.id]),
      this.db.query<any>("select c.id,c.amount,c.basis_amount,c.rate,c.currency,c.status,c.created_at,c.eligible_at,o.order_number from affiliate_commissions c join orders o on o.id=c.order_id where c.affiliate_id=$1 order by c.created_at desc limit 60",[aff.id]),
      this.db.query<any>("select id,amount,currency,method,transfer_reference,destination_last4,recorded_at from affiliate_payouts where affiliate_id=$1 order by recorded_at desc limit 40",[aff.id])
    ]);
    const row=aggregated.rows[0]||{};
    return {
      program,
      application:{code:aff.code,status:aff.status,rate:Number(aff.rate),channelName:aff.channel_name,
        channelUrl:aff.channel_url,payoutMethod:aff.payout_method,payoutRecipient:aff.payout_recipient,
        payoutMasked:aff.payout_destination?this.mask(aff.payout_destination):null,createdAt:aff.created_at},
      stats:{clicks:Number(clicks.rows[0]?.n||0),conversions:Number(row.orders||0),pending:money(row.pending),
        approved:money(row.approved),paid:money(row.paid),reversalDue:money(row.reversal_due)},
      commissions:commissions.rows.map(x=>({id:x.id,orderNumber:x.order_number,amount:money(x.amount),
        basisAmount:money(x.basis_amount),rate:Number(x.rate),currency:x.currency,status:x.status,
        createdAt:x.created_at,eligibleAt:x.eligible_at})),
      payouts:payouts.rows.map(x=>({...x,amount:money(x.amount)}))
    };
  }
  async payoutDetails(token:string|undefined,body:any){
    const a=await this.identity(token),s=await this.store();
    const method=clean(body?.method,30),recipient=clean(body?.recipient,120);
    const destination=clean(body?.destination,60).replace(/\s/g,"").toUpperCase();
    if(!methods.includes(method)||recipient.length<3)throw new BadRequestException("Enter payout method and account holder name");
    if(method==="bank"&&!/^PK\d{2}[A-Z0-9]{20}$/.test(destination))throw new BadRequestException("Enter a valid 24-character Pakistan IBAN");
    if(method!=="bank"&&!/^(?:03\d{9}|923\d{9})$/.test(destination))throw new BadRequestException("Enter a Pakistan wallet mobile number");
    const r=await this.db.query<any>(
      "update affiliates set payout_method=$1,payout_recipient=$2,payout_destination=$3,updated_at=now() where store_id=$4 and account_id=$5 returning id",
      [method,recipient,destination,s.id,a.id]);
    if(!r.rowCount)throw new NotFoundException("Affiliate application not found");
    return {ok:true,payoutMethod:method,payoutRecipient:recipient,payoutMasked:this.mask(destination)};
  }

  // No raw IP, customer identity or fingerprint in visit rows.
  async visit(body:any){
    const s=await this.store(),program=await this.settings(s.id);
    if(!program.enabled)throw new NotFoundException("Referral program is not open");
    const code=clean(body?.code,30).toUpperCase();
    if(!/^[A-Z0-9]{5,20}$/.test(code))throw new NotFoundException("Referral code not found");
    const a=await this.db.query<any>("select id from affiliates where store_id=$1 and code=$2 and status='approved'",[s.id,code]);
    if(!a.rowCount)throw new NotFoundException("Referral code not found");
    let landing=clean(body?.landing,160);
    if(!landing.startsWith("/")||landing.startsWith("//")||landing.includes("\\")||/[\r\n]/.test(landing)||
       landing.startsWith("/api/")||landing.startsWith("/r/"))landing="/collections";
    const token=randomBytes(32).toString("base64url");
    await this.db.query(
      "insert into affiliate_visits(store_id,affiliate_id,token_hash,landing_path,expires_at) values($1,$2,$3,$4,now()+($5::int*interval '1 day'))",
      [s.id,a.rows[0].id,this.hash(token),landing,Number(program.cookie_days)]
    );
    return {ok:true,token,landing,cookieDays:Number(program.cookie_days)};
  }
  async attach(body:any){
    const s=await this.store(),id=clean(body?.checkoutId,80),token=clean(body?.visitToken,160);
    if(!uuid(id)||!/^[A-Za-z0-9_-]{40,150}$/.test(token))throw new BadRequestException("Invalid attribution");
    const program=await this.settings(s.id);
    if(!program.enabled)return {ok:true,attributed:false};
    return this.db.transaction(async client=>{
      const checkout=await client.query<any>("select id from checkout_sessions where id=$1 and store_id=$2 and status='open' and expires_at>now() for update",[id,s.id]);
      if(!checkout.rowCount)throw new NotFoundException("Open checkout not found");
      const existing=await client.query<any>("select id from affiliate_checkout_attributions where checkout_id=$1",[id]);
      if(existing.rowCount)return {ok:true,attributed:true};
      const visited=await client.query<any>(
        "select v.id,v.affiliate_id from affiliate_visits v join affiliates a on a.id=v.affiliate_id where v.store_id=$1 and v.token_hash=$2 and v.expires_at>now() and a.status='approved' and a.store_id=$1",
        [s.id,this.hash(token)]);
      if(!visited.rowCount)return {ok:true,attributed:false};
      await client.query("insert into affiliate_checkout_attributions(checkout_id,store_id,affiliate_id,visit_id) values($1,$2,$3,$4)",[id,s.id,visited.rows[0].affiliate_id,visited.rows[0].id]);
      return {ok:true,attributed:true};
    });
  }

  async adminOverview(){
    const s=await this.store(),program=await this.program();
    const [affiliateRows,commissionRows,payoutRows]=await Promise.all([
      this.db.query<any>(
        "select a.*,u.display_name,u.email,(select count(*)::int from affiliate_visits v where v.affiliate_id=a.id) clicks,(select count(*)::int from affiliate_commissions c where c.affiliate_id=a.id) orders from affiliates a join storefront_accounts u on u.id=a.account_id where a.store_id=$1 order by a.created_at desc limit 300",[s.id]),
      this.db.query<any>(
        "select c.*,o.order_number,o.status order_status,o.payment_status,o.fulfillment_status,o.fulfilled_at,o.created_at order_created_at,a.code,a.status affiliate_status,exists(select 1 from returns r where r.order_id=o.id and r.status<>'rejected') has_return,exists(select 1 from payment_transactions p where p.order_id=o.id and p.transaction_type='refund' and p.status='succeeded') refunded from affiliate_commissions c join orders o on o.id=c.order_id join affiliates a on a.id=c.affiliate_id where c.store_id=$1 order by c.created_at desc limit 500",[s.id]),
      this.db.query<any>(
        "select p.id,p.affiliate_id,p.amount,p.currency,p.method,p.transfer_reference,p.destination_last4,p.recipient_snapshot,p.recorded_at,a.code from affiliate_payouts p join affiliates a on a.id=p.affiliate_id where p.store_id=$1 order by p.recorded_at desc limit 150",[s.id])
    ]);
    const affs=affiliateRows.rows,cs=commissionRows.rows;
    return {
      program,
      summary:{affiliates:affs.length,pendingApplications:affs.filter(x=>x.status==="pending").length,
        totalClicks:affs.reduce((v,x)=>v+Number(x.clicks),0),
        pendingCommissions:money(cs.filter(x=>x.status==="pending").reduce((v,x)=>v+Number(x.amount),0)),
        approvedCommissions:money(cs.filter(x=>x.status==="approved").reduce((v,x)=>v+Number(x.amount),0)),
        paidCommissions:money(cs.filter(x=>x.status==="paid").reduce((v,x)=>v+Number(x.amount),0))},
      affiliates:affs.map(x=>({id:x.id,code:x.code,status:x.status,rate:Number(x.rate),name:x.display_name,
        email:x.email,channelName:x.channel_name,channelUrl:x.channel_url,payoutMethod:x.payout_method,
        payoutRecipient:x.payout_recipient,payoutMasked:x.payout_destination?this.mask(x.payout_destination):null,
        payoutReady:Boolean(x.payout_method&&x.payout_recipient&&x.payout_destination),
        clicks:Number(x.clicks),orders:Number(x.orders),createdAt:x.created_at,reviewedAt:x.reviewed_at})),
      commissions:cs.map(x=>({id:x.id,affiliateId:x.affiliate_id,orderId:x.order_id,
        orderNumber:x.order_number,code:x.code,amount:money(x.amount),basisAmount:money(x.basis_amount),
        rate:Number(x.rate),currency:x.currency,status:x.status,affiliateStatus:x.affiliate_status,
        orderStatus:x.order_status,paymentStatus:x.payment_status,fulfillmentStatus:x.fulfillment_status,
        risk:Boolean(x.has_return||x.refunded||x.order_status==="canceled"||x.payment_status==="refunded"),
        ready:Boolean(x.payment_status==="paid"&&x.fulfillment_status==="fulfilled"&&
          !x.has_return&&!x.refunded&&x.order_status!=="canceled"&&x.affiliate_status==="approved"&&
          Date.now()>=new Date(x.fulfilled_at||x.order_created_at).getTime()+Number(program.holdDays)*86400000),
        eligibleAt:new Date(new Date(x.fulfilled_at||x.order_created_at).getTime()+Number(program.holdDays)*86400000).toISOString(),
        createdAt:x.created_at,approvedAt:x.approved_at,paidAt:x.paid_at,note:x.review_note})),
      payouts:payoutRows.rows.map(x=>({...x,amount:money(x.amount)}))
    };
  }
  async updateSettings(body:any){
    const s=await this.store();
    const enabled=body?.enabled===true,rate=Number(body?.defaultRate),cookie=Number(body?.cookieDays);
    const hold=Number(body?.holdDays),minimum=Number(body?.minPayout);
    if(!Number.isFinite(rate)||rate<0||rate>30||!Number.isInteger(cookie)||cookie<1||cookie>90||
       !Number.isInteger(hold)||hold<0||hold>90||!Number.isFinite(minimum)||minimum<0||minimum>1000000)
      throw new BadRequestException("Invalid program settings");
    await this.db.query(
      "insert into affiliate_program_settings(store_id,enabled,default_rate,cookie_days,hold_days,min_payout) values($1,$2,$3,$4,$5,$6) on conflict(store_id) do update set enabled=excluded.enabled,default_rate=excluded.default_rate,cookie_days=excluded.cookie_days,hold_days=excluded.hold_days,min_payout=excluded.min_payout,updated_at=now()",
      [s.id,enabled,rate,cookie,hold,money(minimum)]);
    return this.program();
  }
  async reviewAffiliate(id:string,body:any){
    const s=await this.store(),status=clean(body?.status,20),rate=Number(body?.rate);
    if(!uuid(id)||!["approved","rejected","suspended","pending"].includes(status)||!Number.isFinite(rate)||rate<0||rate>30)
      throw new BadRequestException("Invalid affiliate decision");
    const r=await this.db.query<any>(
      "update affiliates set status=$1,rate=$2,reviewed_at=now(),updated_at=now() where id=$3 and store_id=$4 returning id,code,status,rate",[status,rate,id,s.id]);
    if(!r.rowCount)throw new NotFoundException("Affiliate not found");
    return {ok:true,...r.rows[0]};
  }
  private async payableCheck(client:PoolClient,id:string,storeId:string){
    const r=await client.query<any>(
      "select c.*,o.status order_status,o.payment_status,o.fulfillment_status,o.fulfilled_at,o.created_at order_created_at,a.status affiliate_status,a.payout_method,a.payout_recipient,a.payout_destination,s.hold_days from affiliate_commissions c join orders o on o.id=c.order_id join affiliates a on a.id=c.affiliate_id left join affiliate_program_settings s on s.store_id=c.store_id where c.id=$1 and c.store_id=$2 for update of c",[id,storeId]);
    if(!r.rowCount)throw new NotFoundException("Commission not found");
    const c=r.rows[0];
    if(c.order_status==="canceled"||c.payment_status!=="paid"||c.fulfillment_status!=="fulfilled"||c.affiliate_status!=="approved")
      throw new ConflictException("Order must be paid and fulfilled, and affiliate approved");
    if(Date.now()<new Date(c.fulfilled_at||c.order_created_at).getTime()+Number(c.hold_days??14)*86400000)
      throw new ConflictException("Return/hold window has not ended");
    const problem=await client.query<any>(
      "select 1 from returns where order_id=$1 and status<>'rejected' union all select 1 from payment_transactions where order_id=$1 and transaction_type='refund' and status='succeeded' limit 1",
      [c.order_id]);
    if(problem.rowCount)throw new ConflictException("Order has a return or refund");
    return c;
  }
  async approveCommission(id:string){
    if(!uuid(id))throw new BadRequestException("Invalid commission ID");
    const s=await this.store();
    return this.db.transaction(async client=>{
      const c=await this.payableCheck(client,id,s.id);
      if(c.status==="approved")return {ok:true,status:"approved",idempotent:true};
      if(c.status!=="pending")throw new ConflictException("Only pending commissions can be approved");
      await client.query("update affiliate_commissions set status='approved',approved_at=now(),updated_at=now() where id=$1",[id]);
      return {ok:true,status:"approved"};
    });
  }
  async reverseCommission(id:string,body:any){
    if(!uuid(id))throw new BadRequestException("Invalid commission ID");
    const s=await this.store(),reason=clean(body?.reason,240);
    if(reason.length<5)throw new BadRequestException("Provide a reason (at least 5 characters)");
    return this.db.transaction(async client=>{
      const r=await client.query<any>("select status from affiliate_commissions where id=$1 and store_id=$2 for update",[id,s.id]);
      if(!r.rowCount)throw new NotFoundException("Commission not found");
      if(["reversed","reversal_due"].includes(r.rows[0].status))return {ok:true,status:r.rows[0].status,idempotent:true};
      const next=r.rows[0].status==="paid"?"reversal_due":"reversed";
      await client.query("update affiliate_commissions set status=$1,reversed_at=now(),review_note=$2,updated_at=now() where id=$3",[next,reason,id]);
      return {ok:true,status:next};
    });
  }
  async recordPayout(id:string,body:any){
    const s=await this.store();
    if(!uuid(id)||body?.transferConfirmed!==true)
      throw new BadRequestException("An approved affiliate and confirmed external transfer are required");
    const raw=Array.isArray(body?.commissionIds)?body.commissionIds.map((v:any)=>String(v)):[];
    const ids=[...new Set<string>(raw)];
    if(!ids.length||ids.length>100||ids.some(x=>!uuid(x)))throw new BadRequestException("Select 1–100 valid commissions");
    const reference=clean(body?.transferReference,100);
    if(reference.length<6)throw new BadRequestException("Bank/wallet transfer reference is required");
    return this.db.transaction(async client=>{
      const partner=await client.query<any>("select * from affiliates where id=$1 and store_id=$2 and status='approved' for update",[id,s.id]);
      if(!partner.rowCount)throw new ConflictException("Affiliate must be approved");
      const a=partner.rows[0];
      if(!a.payout_method||!a.payout_recipient||!a.payout_destination)throw new ConflictException("Affiliate payout details are missing");
      const commissions:any[]=[];
      for(const commissionId of ids.sort()){
        const c=await this.payableCheck(client,commissionId,s.id);
        if(c.affiliate_id!==id||c.status!=="approved")throw new ConflictException("All commissions must be approved for this affiliate");
        commissions.push(c);
      }
      const total=money(commissions.reduce((v,x)=>v+Number(x.amount),0));
      const settings=await this.settings(s.id);
      if(total<Number(settings.min_payout))throw new ConflictException("Minimum payout is Rs. "+settings.min_payout);
      const prior=await client.query<any>(
        "select id from affiliate_payouts where store_id=$1 and method=$2 and transfer_reference=$3",
        [s.id,a.payout_method,reference]);
      if(prior.rowCount)throw new ConflictException("Transfer reference already recorded");
      const payout=await client.query<any>(
        "insert into affiliate_payouts(store_id,affiliate_id,amount,currency,method,transfer_reference,recipient_snapshot,destination_last4) values($1,$2,$3,'PKR',$4,$5,$6,$7) returning id",
        [s.id,id,total,a.payout_method,reference,a.payout_recipient,this.mask(a.payout_destination)]);
      for(const c of commissions){
        await client.query("insert into affiliate_payout_items(payout_id,commission_id,amount) values($1,$2,$3)",[payout.rows[0].id,c.id,c.amount]);
        await client.query("update affiliate_commissions set status='paid',paid_at=now(),updated_at=now() where id=$1",[c.id]);
      }
      return {ok:true,payoutId:payout.rows[0].id,total,currency:"PKR",commissionCount:commissions.length};
    });
  }
  async reconcile(){
    const s=await this.store();
    return this.db.transaction(async client=>{
      const risk=await client.query<any>(
        "select c.id,c.status from affiliate_commissions c join orders o on o.id=c.order_id where c.store_id=$1 and c.status in ('pending','approved','paid') and (o.status='canceled' or o.payment_status in ('refunded','failed') or exists(select 1 from returns r where r.order_id=o.id and r.status<>'rejected') or exists(select 1 from payment_transactions p where p.order_id=o.id and p.transaction_type='refund' and p.status='succeeded')) for update of c",[s.id]);
      let reversed=0,reversalDue=0;
      for(const row of risk.rows){
        const status=row.status==="paid"?"reversal_due":"reversed";
        await client.query(
          "update affiliate_commissions set status=$1,reversed_at=now(),review_note='Refund/return/cancellation reconciliation',updated_at=now() where id=$2",
          [status,row.id]);
        if(status==="reversal_due")reversalDue++;else reversed++;
      }
      return {ok:true,reversed,reversalDue};
    });
  }
}
