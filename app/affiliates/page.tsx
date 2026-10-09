import Link from "next/link";
import {PageHeader} from "@/components/page-header";
import {adminRequest} from "@/lib/admin-api";
import {
  affiliateProgramAction,reviewAffiliateAction,approveAffiliateCommissionAction,
  reverseAffiliateCommissionAction,recordAffiliatePayoutAction,
  reconcileAffiliateCommissionsAction,
} from "./actions";

type Affiliate={
  id:string;code:string;status:string;rate:number;name:string;email:string;
  channelName:string|null;channelUrl:string|null;payoutMethod:string|null;payoutRecipient:string|null;
  payoutMasked:string|null;payoutReady:boolean;clicks:number;orders:number;createdAt:string;
};
type Commission={
  id:string;affiliateId:string;orderId:string;orderNumber:string;code:string;amount:number;basisAmount:number;
  rate:number;currency:string;status:string;affiliateStatus:string;orderStatus:string;paymentStatus:string;
  fulfillmentStatus:string;risk:boolean;ready:boolean;eligibleAt:string;createdAt:string;note:string|null;
};
type Payout={id:string;affiliate_id:string;amount:number;method:string;code:string;transfer_reference:string;recorded_at:string;destination_last4:string};
type Snapshot={
  program:{enabled:boolean;defaultRate:number;cookieDays:number;holdDays:number;minPayout:number;currency:string};
  summary:{affiliates:number;pendingApplications:number;totalClicks:number;pendingCommissions:number;approvedCommissions:number;paidCommissions:number};
  affiliates:Affiliate[];commissions:Commission[];payouts:Payout[];
};
const money=(v:any)=>"Rs. "+Number(v||0).toLocaleString("en-PK",{maximumFractionDigits:2});
const date=(v:any)=>v?new Date(v).toLocaleString("en-PK"):"—";

export const dynamic="force-dynamic";
export default async function AffiliatesAdmin(){
  const data=await adminRequest<Snapshot>("/v1/admin/affiliates",0);
  if(!data)return <><PageHeader eyebrow="GROWTH / PARTNERS" title="Affiliates" description="Affiliate analytics and payouts will appear when the backend is connected."/></>;
  const {program,summary,affiliates,commissions,payouts}=data;
  return <>
    <PageHeader eyebrow="GROWTH / PARTNERS" title="Affiliate marketing"
      description="Own your referral program: applicants, tracked visits, attributed COD orders, audited commissions, and manual payouts."/>
    <div className="affiliate-admin-intro">
      <div><span className="affiliate-admin-indicator">{program.enabled?"● Program enabled":"○ Program paused"}</span>
      <h2>Partner growth, under your control.</h2><p>New applications require your approval. Sales earn pending commission but cannot be paid until the order is paid, fulfilled, and the return window has ended.</p></div>
      <div className="affiliate-admin-intro-link"><span>PUBLIC PARTNER PAGE</span><Link href="https://jewelry-store-lime.vercel.app/affiliate" target="_blank" rel="noopener noreferrer">Open affiliate landing page ↗</Link><small>No actual wallet or bank transfers are made by this dashboard.</small></div>
    </div>
    <div className="affiliate-admin-stats">
      {[
        ["Affiliates",summary.affiliates,"Accounts registered"],
        ["Awaiting approval",summary.pendingApplications,"New applications"],
        ["Tracked clicks",summary.totalClicks,"First-party referral visits"],
        ["Pending",money(summary.pendingCommissions),"Not yet approved"],
        ["Approved",money(summary.approvedCommissions),"Eligible to transfer"],
        ["Recorded paid",money(summary.paidCommissions),"Transfer references saved"],
      ].map(([label,value,description])=><article className="panel" key={String(label)}><small>{label}</small><strong>{value}</strong><span>{description}</span></article>)}
    </div>
    <section className="panel affiliate-admin-settings">
      <div className="panel-head"><div><span>POLICY / PROGRAM</span><h2>Program configuration</h2></div></div>
      <form action={affiliateProgramAction} className="affiliate-admin-settings-form">
        <label><span>Default commission (%)</span><input type="number" name="defaultRate" min="0" max="30" step=".25" defaultValue={program.defaultRate} required/></label>
        <label><span>Attribution window (days)</span><input type="number" name="cookieDays" min="1" max="90" defaultValue={program.cookieDays} required/></label>
        <label><span>Post-fulfillment hold (days)</span><input type="number" name="holdDays" min="0" max="90" defaultValue={program.holdDays} required/></label>
        <label><span>Minimum payout (PKR)</span><input type="number" name="minPayout" step="0.01" min="0" defaultValue={program.minPayout} required/></label>
        <label className="affiliate-admin-toggle"><input type="checkbox" name="enabled" defaultChecked={program.enabled}/><span>Accept new applications and track new referrals</span></label>
        <button type="submit" className="primary-button">Save affiliate policy</button>
      </form>
      <p className="affiliate-admin-fineprint">Default rate applies to new partner applications. Existing orders preserve their original commission rate; changing policy never retroactively rewrites them.</p>
    </section>
    <section className="panel table-wrap affiliate-admin-section">
      <div className="panel-head"><div><span>PARTNER REVIEW</span><h2>Affiliate applications</h2></div><b>{affiliates.length} partners</b></div>
      <table className="data-table">
        <thead><tr><th>PARTNER</th><th>CHANNEL</th><th>TRAFFIC</th><th>PAYOUT ACCOUNT</th><th>APPLICATION / RATE</th></tr></thead>
        <tbody>
          {affiliates.map(affiliate=><tr key={affiliate.id}>
            <td><b>{affiliate.name}</b><small>{affiliate.email}</small><code>{affiliate.code}</code></td>
            <td><b>{affiliate.channelName||"Not supplied"}</b>{affiliate.channelUrl&&<small><a target="_blank" rel="noopener noreferrer" href={affiliate.channelUrl}>Visit channel ↗</a></small>}</td>
            <td>{affiliate.clicks} clicks<small>{affiliate.orders} attributed orders</small></td>
            <td>{affiliate.payoutReady?<><b>{affiliate.payoutMethod}</b><small>{affiliate.payoutRecipient} · {affiliate.payoutMasked}</small></>:"Not set"}</td>
            <td><form action={reviewAffiliateAction.bind(null,affiliate.id)} className="affiliate-admin-inline">
              <select aria-label={"Status for "+affiliate.name} defaultValue={affiliate.status} name="status">
                <option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="suspended">Suspended</option>
              </select>
              <label><span>Rate %</span><input name="rate" type="number" min="0" max="30" step=".25" defaultValue={affiliate.rate} aria-label={"Rate for "+affiliate.name}/></label>
              <button className="secondary-button" type="submit">Save</button>
            </form></td>
          </tr>)}
          {!affiliates.length&&<tr><td colSpan={5}>No affiliate applications. Enable the program and share the public application page.</td></tr>}
        </tbody>
      </table>
    </section>

    <section className="panel table-wrap affiliate-admin-section">
      <div className="panel-head"><div><span>ORDER ATTRIBUTION</span><h2>Commission ledger</h2></div>
        <form action={reconcileAffiliateCommissionsAction}><button className="secondary-button" type="submit">Reconcile refunds & returns ↻</button></form>
      </div>
      <p className="affiliate-admin-fineprint">Only orders that are paid, fulfilled and past the configured hold window can be approved. Returns and refunds block payout. If a previously paid commission is reversed later, it becomes a manual recovery item.</p>
      <table className="data-table">
        <thead><tr><th>ORDER / PARTNER</th><th>CALCULATION</th><th>ELIGIBILITY</th><th>COMMISSION</th><th>ADMIN REVIEW</th></tr></thead>
        <tbody>
          {commissions.map(c=><tr key={c.id}>
            <td><Link href={"/orders/"+c.orderId}><b>{c.orderNumber}</b></Link><small>Partner {c.code} · {date(c.createdAt)}</small></td>
            <td><b>{money(c.basisAmount)}</b><small>Net merchandise × {c.rate}%</small></td>
            <td>
              <span className={"affiliate-admin-status "+(c.risk?"bad":c.ready?"good":"pending")}>{c.risk?"⚠ Refund / return risk":c.ready?"✓ Eligible":"Hold / unpaid / unfulfilled"}</span>
              <small>Payment: {c.paymentStatus} · Delivery: {c.fulfillmentStatus}</small>
              <small>Not before: {date(c.eligibleAt)}</small>
            </td>
            <td><strong>{money(c.amount)}</strong><small>Status: {c.status.replaceAll("_"," ")}</small></td>
            <td>
              {c.status==="pending"&&c.ready&&<form action={approveAffiliateCommissionAction.bind(null,c.id)}><button className="primary-button" type="submit">Approve commission</button></form>}
              {(c.status==="pending"||c.status==="approved"||c.status==="paid")&&<form action={reverseAffiliateCommissionAction.bind(null,c.id)} className="affiliate-admin-reverse">
                <input name="reason" required minLength={5} maxLength={240} placeholder="Reversal reason / return / fraud"/>
                <button className="secondary-button" type="submit">Reverse</button>
              </form>}
              {(c.status==="reversed"||c.status==="reversal_due")&&<small>{c.note||c.status}</small>}
            </td>
          </tr>)}
          {!commissions.length&&<tr><td colSpan={5}>No attributed orders. No referral commissions have been created yet.</td></tr>}
        </tbody>
      </table>
    </section>

    <section className="panel affiliate-admin-section">
      <div className="panel-head"><div><span>FINANCE / MANUAL TRANSFERS</span><h2>Payout recording</h2></div></div>
      <p className="affiliate-admin-fineprint">First transfer money through your bank, JazzCash or Easypaisa separately. Then select the approved commissions and record the exact successful transfer reference here. This system does <strong>not</strong> send money automatically.</p>
      <div className="affiliate-admin-payouts">
        {affiliates.filter(a=>a.status==="approved").map(a=>{
          const selectable=commissions.filter(c=>c.affiliateId===a.id&&c.status==="approved"&&c.ready);
          return <article key={a.id} className="affiliate-admin-payout-card">
            <div><h3>{a.name}</h3><small>{a.code} · {a.payoutMethod||"No payment method"} {a.payoutMasked||""}</small></div>
            <p>{selectable.length} eligible approved commissions · Minimum transfer {money(program.minPayout)}.</p>
            {a.payoutReady&&selectable.length?<form action={recordAffiliatePayoutAction.bind(null,a.id)}>
              <div className="affiliate-admin-commission-choice">
                {selectable.map(c=><label key={c.id}><input type="checkbox" name="commissionIds" value={c.id}/><span>{c.orderNumber}</span><b>{money(c.amount)}</b></label>)}
              </div>
              <label className="affiliate-admin-transfer"><span>Completed external transfer reference</span><input name="transferReference" required minLength={6} placeholder="Bank / wallet receipt reference"/></label>
              <label className="affiliate-admin-transfer-confirm"><input required type="checkbox" name="transferConfirmed"/><span>I confirm the actual payment was already sent and succeeded.</span></label>
              <button className="primary-button" type="submit">Record completed payout</button>
            </form>:<small>{!a.payoutReady?"Partner must save payout details first.":"No commissions available to record."}</small>}
          </article>;
        })}
        {!affiliates.some(a=>a.status==="approved")&&<p>Approved affiliates and their eligible commissions will appear here.</p>}
      </div>
    </section>

    <section className="panel table-wrap affiliate-admin-section">
      <div className="panel-head"><div><span>ACCOUNTING AUDIT</span><h2>Recorded payouts</h2></div></div>
      <table className="data-table"><thead><tr><th>PARTNER</th><th>TRANSFER</th><th>REFERENCE</th><th>RECORDED AT</th><th>AMOUNT</th></tr></thead><tbody>
        {payouts.map(p=><tr key={p.id}><td>{p.code}</td><td>{p.method}<small>{p.destination_last4}</small></td><td>{p.transfer_reference}</td><td>{date(p.recorded_at)}</td><td><b>{money(p.amount)}</b></td></tr>)}
        {!payouts.length&&<tr><td colSpan={5}>No payouts have been recorded. Nothing has been transferred by this system.</td></tr>}
      </tbody></table>
    </section>
  </>;
}
