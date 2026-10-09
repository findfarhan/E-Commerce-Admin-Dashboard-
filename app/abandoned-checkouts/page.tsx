import Link from "next/link";
import {PageHeader} from "@/components/page-header";
import {adminRequest} from "@/lib/admin-api";
import "./abandoned.css";

type Recovery={
 summary:{total:number;pending:number;recovered:number;suppressed:number;expired:number;recoveredValue:number;deliveryEnabled:boolean};
 items:Array<{checkout_id:string;email_snapshot:string;consent_at:string;status:string;send_step:number;next_send_at:string|null;last_sent_at:string|null;subtotal:number;total:number;expires_at:string}>;
 steps:Array<{step:number;status:string;count:number}>;
};
const money=(amount:number)=>"Rs. "+Number(amount||0).toLocaleString("en-PK",{maximumFractionDigits:0});
const date=(value:string|null)=>value?new Date(value).toLocaleString("en-PK",{timeZone:"Asia/Karachi"}):"—";

export default async function AbandonedCheckouts(){
 let report:Recovery|null=null;let error="";
 try{report=await adminRequest<Recovery>("/v1/admin/recovery/overview");}catch(e){error=e instanceof Error?e.message:"Recovery report unavailable";}
 return <main className="recovery-admin-page">
   <PageHeader eyebrow="GROWTH / RECOVERY" title="Abandoned Checkouts"
    description="Follow opted-in shoppers, transparent recovery attempts, recovered COD orders and consent-aware email delivery.">
    <Link href="/analytics" className="secondary-button">Conversion analytics ↗</Link>
   </PageHeader>
   {!report?<section className="panel recovery-admin-empty"><h2>Recovery reporting not ready</h2><p>{error||"Check API deployment and migration 026."}</p></section>:<>
    <div className="recovery-admin-kpis" aria-label="30 day checkout recovery performance">
     <article><span>Opted-in checkouts</span><strong>{report.summary.total}</strong><small>Last 30 days</small></article>
     <article><span>Awaiting conversion</span><strong>{report.summary.pending}</strong><small>Consent recorded</small></article>
     <article><span>Recovered orders</span><strong>{report.summary.recovered}</strong><small>Confirmed COD orders</small></article>
     <article><span>Recovered order value</span><strong>{money(report.summary.recoveredValue)}</strong><small>Not identical to cash collected</small></article>
    </div>
    <section className="recovery-admin-status" aria-label="Email recovery configuration">
      <div><b>Email delivery</b><p>{report.summary.deliveryEnabled?
        "Email reminders enabled. Consent, purchase state and suppression are checked before sending.":
        "Safely paused. Set RECOVERY_EMAIL_ENABLED=true, RECOVERY_SIGNING_SECRET, RESEND_API_KEY and RECOVERY_FROM_EMAIL in the API service to enable delivery."}</p></div>
      <span>{report.summary.deliveryEnabled?"Enabled":"Paused — no outbound email"}</span>
    </section>
    <section className="panel recovery-admin-table">
     <div className="panel-head"><div><span>CONSENTED CHECKOUTS</span><h2>Recovery opportunities</h2><p>Only checkouts with explicit email reminder consent appear here. {report.summary.expired} consent window(s) expired in the last 30 days. Recovery links are never exposed in admin responses.</p></div></div>
     <div className="table-wrap"><table className="data-table">
      <thead><tr><th>CHECKOUT</th><th>EMAIL</th><th>STATUS</th><th>ATTEMPTS</th><th>NEXT REMINDER</th><th className="right">VALUE</th></tr></thead>
      <tbody>
       {report.items.map(row=><tr key={row.checkout_id}>
         <td className="order-id"><b>{row.checkout_id.slice(0,8)}…</b><small>{date(row.consent_at)}</small></td>
         <td>{row.email_snapshot}</td>
         <td><span className={"recovery-state "+row.status}>{row.status}</span></td>
         <td>{row.send_step}/3</td>
         <td>{date(row.next_send_at)}</td>
         <td className="right">{money(row.total||row.subtotal)}</td>
       </tr>)}
       {!report.items.length&&<tr><td colSpan={6}>No shoppers have opted in to checkout reminders yet. No unconsented emails will be sent.</td></tr>}
      </tbody>
     </table></div>
    </section>
    <section className="panel recovery-attempts">
      <div className="panel-head"><div><span>DELIVERY AUDIT</span><h2>Reminder delivery attempts</h2></div></div>
      <div className="recovery-attempt-grid">{report.steps.map(row=><article key={row.step+"-"+row.status}><span>Reminder {row.step}</span><strong>{row.count}</strong><small>{row.status}</small></article>)}
       {!report.steps.length&&<p>No recovery emails have been attempted.</p>}
      </div>
    </section>
    <p className="recovery-admin-foot">Recovery value counts orders generated through a validated recovery link; it is not attributed to simply opening an email. COD orders are not treated as paid revenue until payment is received.</p>
   </>}
 </main>;
}
