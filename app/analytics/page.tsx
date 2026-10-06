import {PageHeader} from "@/components/page-header";
import {adminRequest} from "@/lib/admin-api";

const money=(value:number)=>"Rs. "+Math.round(value).toLocaleString("en-PK");

export default async function Analytics(){
  const data=await adminRequest<any>("/v1/admin/operations/analytics",0);
  if(!data) throw new Error("Live analytics unavailable.");
  const max=Math.max(1,...(data.daily||[]).map((day:any)=>Number(day.revenue||0)));

  return <>
    <PageHeader eyebrow="ANALYTICS / LIVE" title="Store performance" description="Commerce metrics calculated directly from orders, customers and checkout sessions."/>
    <section className="stats-grid">
      <article className="stat-card"><span>REVENUE</span><strong>{money(data.revenue30d)}</strong><small>Paid revenue · 30 days</small></article>
      <article className="stat-card"><span>AOV</span><strong>{money(data.aov30d)}</strong><small>{data.orders30d} orders · 30 days</small></article>
      <article className="stat-card"><span>REPEAT RATE</span><strong>{data.repeatRate}%</strong><small>{data.knownCustomers} known customers</small></article>
      <article className="stat-card"><span>CHECKOUT → ORDER</span><strong>{data.checkoutConversion}%</strong><small>Completed server checkouts</small></article>
    </section>
    <article className="panel">
      <div className="panel-head"><div><span>REVENUE TREND</span><h2>Last 30 days</h2></div></div>
      <div style={{height:280,display:"flex",alignItems:"end",gap:5,padding:"28px 12px 12px"}}>
        {(data.daily||[]).map((day:any)=><div key={day.day} title={new Date(day.day).toLocaleDateString("en-PK")+" · "+money(day.revenue)} style={{height:"100%",flex:1,display:"flex",alignItems:"end"}}>
          <div style={{width:"100%",minHeight:2,height:Math.max(2,Number(day.revenue||0)/max*100)+"%",background:"var(--accent-2)",borderRadius:"4px 4px 0 0"}}/>
        </div>)}
      </div>
    </article>
  </>;
}
