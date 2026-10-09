import {PageHeader} from "@/components/page-header";
import {adminRequest} from "@/lib/admin-api";
import "./conversion.css";
import Link from "next/link";
const money=(value:number)=>"Rs. "+Math.round(Number(value||0)).toLocaleString("en-PK");
export default async function Analytics(){
  const [base,report,conversion]=await Promise.all([adminRequest<any>("/v1/admin/operations/analytics",0),adminRequest<any>("/v1/admin/commerce/report",0),adminRequest<any>("/v1/admin/conversion/overview",0)]);
  if(!base||!report) throw new Error("Live analytics unavailable.");
  const max=Math.max(1,...(base.daily||[]).map((day:any)=>Number(day.revenue||0)));
  return <><PageHeader eyebrow="ANALYTICS / LIVE" title="Store performance" description="Revenue, margin, product, variant, inventory, customer, channel, collection and location performance from live commerce data."/>
  <section className="stats-grid">
    <article className="stat-card"><span>30D REVENUE</span><strong>{money(report.revenue)}</strong><small>{report.orders} orders</small></article>
    <article className="stat-card"><span>GROSS PROFIT</span><strong>{money(report.gross_profit)}</strong><small>{report.gross_margin}% margin</small></article>
    <article className="stat-card"><span>AOV</span><strong>{money(report.aov)}</strong><small>{report.customers} customers</small></article>
    <article className="stat-card"><span>CHECKOUT → ORDER</span><strong>{report.checkout_conversion}%</strong><small>{report.repeat_customers} repeat customers</small></article>
  </section>
  {conversion&&<section className="conversion-overview">
    <div className="panel-head"><div><span>PHASE 5 / CONVERSION INTELLIGENCE</span><h2>From discovery to purchase</h2>
      <p>Last 30 days. Anonymous browsing analytics are recorded only after permission. Checkout and confirmed-order counts come from the transaction database.</p></div>
      <Link href="/abandoned-checkouts" className="secondary-button">Abandoned checkout recovery ↗</Link></div>
    <div className="conversion-kpis">
      <article><span>Consenting site sessions</span><strong>{conversion.sessions}</strong><small>Anonymous session IDs, 30 days</small></article>
      <article><span>Checkout starts</span><strong>{conversion.funnel.checkoutStarted}</strong><small>Real checkout records</small></article>
      <article><span>Completed orders</span><strong>{conversion.funnel.ordersCompleted}</strong><small>COD created, not necessarily paid</small></article>
      <article><span>Checkout conversion</span><strong>{conversion.funnel.checkoutConversion}%</strong><small>Orders / checkout starts</small></article>
    </div>
    <div className="conversion-grid">
      <article className="panel conversion-funnel"><div className="panel-head"><div><span>FUNNEL</span><h2>Shopping stages</h2></div></div>
        {[
          ["Site views (opt-in)",conversion.funnel.trackedVisits],
          ["Product interest (opt-in)",conversion.funnel.productViews],
          ["Add to bag (opt-in)",conversion.funnel.addToCart],
          ["Checkout sessions (all)",conversion.funnel.checkoutStarted],
          ["Confirmed orders (all)",conversion.funnel.ordersCompleted]
        ].map(([label,count]:any,index:number)=>{
          const max=Math.max(1,conversion.funnel.trackedVisits,conversion.funnel.checkoutStarted,conversion.funnel.productViews);
          return <div key={label} className="conversion-funnel-row">
            <div><span>{String(index+1).padStart(2,"0")} · {label}</span><b>{count}</b></div>
            <div className="conversion-track"><i style={{width:Math.max(1,Math.min(100,Number(count)/max*100))+"%"}}/></div>
          </div>;
        })}
        <p className="conversion-note">Consent-based browsing sessions and server checkout records are different measurement populations; comparing their stages is directional, not a strict visitor-to-purchase rate.</p>
      </article>
      <article className="panel"><div className="panel-head"><div><span>RECOVERY OPPORTUNITY</span><h2>Unfinished purchases</h2></div></div>
        <div className="conversion-abandoned"><span>Expired checkouts</span><strong>{conversion.funnel.checkoutsExpired}</strong><small>{money(conversion.abandonedValue)} in expired checkout value</small></div>
        <p className="conversion-note">Expired checkout value is not guaranteed lost sales or recoverable revenue. Reminders require explicit consent.</p>
        <Link href="/abandoned-checkouts">View consented checkouts ↗</Link>
      </article>
    </div>
    <div className="conversion-grid">
      <article className="panel table-wrap"><div className="panel-head"><div><span>PRODUCT INTEREST</span><h2>Most explored pieces</h2></div></div>
       <table className="data-table"><thead><tr><th>PRODUCT HANDLE</th><th>VIEWS</th><th>ADDS</th></tr></thead><tbody>
        {(conversion.products||[]).map((x:any)=><tr key={x.product_handle}><td>{x.product_handle}</td><td>{x.views}</td><td>{x.add_to_cart}</td></tr>)}
        {!conversion.products?.length&&<tr><td colSpan={3}>No consented interactions recorded.</td></tr>}
       </tbody></table>
      </article>
      <article className="panel"><div className="panel-head"><div><span>ACQUISITION</span><h2>Traffic by channel</h2></div></div>
       <div className="activity-list">{(conversion.traffic||[]).map((x:any)=><div className="activity-item" key={x.source_channel}><span>◇</span><div><b>{x.source_channel}</b><p>{x.sessions} consenting sessions · {x.events} interactions</p></div></div>)}
        {!conversion.traffic?.length&&<p className="conversion-note">No consented traffic data available yet.</p>}
       </div>
      </article>
    </div>
  </section>}
  <section className="dashboard-grid">
    <article className="panel"><div className="panel-head"><div><span>REVENUE TREND</span><h2>Last 30 days</h2></div></div><div style={{height:260,display:"flex",alignItems:"end",gap:5,padding:"28px 12px 12px"}}>{(base.daily||[]).map((day:any)=><div key={day.day} title={new Date(day.day).toLocaleDateString("en-PK")+" · "+money(day.revenue)} style={{height:"100%",flex:1,display:"flex",alignItems:"end"}}><div style={{width:"100%",minHeight:2,height:Math.max(2,Number(day.revenue||0)/max*100)+"%",background:"var(--accent-2)",borderRadius:"4px 4px 0 0"}}/></div>)}</div></article>
    <article className="panel"><div className="panel-head"><div><span>INVENTORY</span><h2>Valuation</h2></div></div><div className="health-grid"><div className="health-card"><span>UNITS</span><b>{report.inventory_units}</b></div><div className="health-card"><span>COST VALUE</span><b>{money(report.inventory_value)}</b></div></div></article>
  </section>
  <section className="dashboard-grid lower">
    <article className="panel table-wrap"><div className="panel-head"><div><span>PRODUCT PERFORMANCE</span><h2>Top products · 30d</h2></div></div><table className="data-table"><thead><tr><th>PRODUCT</th><th>UNITS</th><th className="right">REVENUE</th></tr></thead><tbody>{(report.products||[]).map((x:any)=><tr key={x.product_id}><td>{x.title}</td><td>{x.units}</td><td className="right">{money(x.revenue)}</td></tr>)}</tbody></table></article>
    <article className="panel table-wrap"><div className="panel-head"><div><span>VARIANT PERFORMANCE</span><h2>SKU economics</h2></div></div><table className="data-table"><thead><tr><th>SKU</th><th>UNITS</th><th>STOCK</th><th>COST</th><th className="right">REVENUE</th></tr></thead><tbody>{(report.variants||[]).slice(0,30).map((x:any)=><tr key={x.variant_id}><td>{x.sku}</td><td>{x.units}</td><td>{x.inventory}</td><td>{money(x.cost_price)}</td><td className="right">{money(x.revenue)}</td></tr>)}</tbody></table></article>
  </section>
  <section className="dashboard-grid lower">
    {[["CHANNELS",report.channels,"source_channel"],["LOCATIONS",report.locations,"location"],["COLLECTIONS",report.collections,"title"]].map(([label,rows,key]:any)=><article className="panel" key={label}><div className="panel-head"><div><span>SALES BY</span><h2>{label}</h2></div></div><div className="activity-list">{(rows||[]).map((x:any,i:number)=><div className="activity-item" key={String(x[key]||i)}><span>•</span><div><b>{x[key]||"Unassigned"}</b><p>{x.orders!==undefined?x.orders+" orders · ":""}{x.units!==undefined?x.units+" units · ":""}{money(x.revenue)}</p></div></div>)}</div></article>)}
  </section></>;
}