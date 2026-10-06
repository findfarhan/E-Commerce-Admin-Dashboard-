import {PageHeader} from "@/components/page-header";
import {adminRequest} from "@/lib/admin-api";

const money=(value:number)=>"Rs. "+Math.round(Number(value||0)).toLocaleString("en-PK");

export default async function Analytics(){
  const data=await adminRequest<any>("/v1/admin/operations/analytics",0);
  if(!data) throw new Error("Live analytics unavailable.");
  const max=Math.max(1,...(data.daily||[]).map((day:any)=>Number(day.revenue||0)));

  return <>
    <PageHeader eyebrow="ANALYTICS / PROFITABILITY" title="Store performance" description="Revenue, refunds, COGS, gross margin, conversion, inventory value and performance by product, collection, location and channel."/>
    <section className="stats-grid">
      <article className="stat-card"><span>NET REVENUE</span><strong>{money(data.netRevenue30d)}</strong><small>{money(data.refunds30d)} refunded · 30 days</small></article>
      <article className="stat-card"><span>GROSS PROFIT</span><strong>{money(data.grossProfit30d)}</strong><small>{data.grossMargin30d}% margin · COGS {money(data.cogs30d)}</small></article>
      <article className="stat-card"><span>AOV</span><strong>{money(data.aov30d)}</strong><small>{data.orders30d} orders · 30 days</small></article>
      <article className="stat-card"><span>CHECKOUT → ORDER</span><strong>{data.checkoutConversion}%</strong><small>{data.repeatRate}% repeat customer rate</small></article>
    </section>
    <section className="stats-grid">
      <article className="stat-card"><span>INVENTORY VALUE</span><strong>{money(data.inventory?.valuation)}</strong><small>{data.inventory?.units||0} sellable units</small></article>
      <article className="stat-card"><span>LOW STOCK SKUS</span><strong>{data.inventory?.lowStockVariants||0}</strong><small>3 units or below</small></article>
      <article className="stat-card"><span>DISCOUNTS</span><strong>{money(data.discounts30d)}</strong><small>Order discount impact</small></article>
      <article className="stat-card"><span>SHIPPING + TAX</span><strong>{money(Number(data.shipping30d||0)+Number(data.tax30d||0))}</strong><small>{money(data.shipping30d)} shipping · {money(data.tax30d)} tax</small></article>
    </section>

    <article className="panel">
      <div className="panel-head"><div><span>NET SALES TREND</span><h2>Last 30 days</h2></div></div>
      <div style={{height:260,display:"flex",alignItems:"end",gap:5,padding:"28px 12px 12px"}}>
        {(data.daily||[]).map((day:any)=><div key={day.day} title={new Date(day.day).toLocaleDateString("en-PK")+" · "+money(day.revenue)} style={{height:"100%",flex:1,display:"flex",alignItems:"end"}}>
          <div style={{width:"100%",minHeight:2,height:Math.max(2,Number(day.revenue||0)/max*100)+"%",background:"var(--accent-2)",borderRadius:"4px 4px 0 0"}}/>
        </div>)}
      </div>
    </article>

    <section className="dashboard-grid" style={{marginTop:14}}>
      <article className="panel"><div className="panel-head"><div><span>PRODUCT / VARIANT</span><h2>Performance</h2></div></div><div className="table-wrap"><table className="data-table"><thead><tr><th>PRODUCT</th><th>SKU</th><th>UNITS</th><th>REVENUE</th><th>COGS</th><th className="right">GROSS PROFIT</th></tr></thead><tbody>
        {(data.productPerformance||[]).slice(0,20).map((row:any)=><tr key={(row.variant_id||row.id)+row.sku}><td><b>{row.title||"Archived product"}</b></td><td>{row.sku||"—"}</td><td>{row.units}</td><td>{money(row.revenue)}</td><td>{money(row.cogs)}</td><td className="right">{money(row.grossProfit)}</td></tr>)}
        {!(data.productPerformance||[]).length&&<tr><td colSpan={6}>Sales will appear after orders are created.</td></tr>}
      </tbody></table></div></article>
      <article className="panel"><div className="panel-head"><div><span>COLLECTIONS</span><h2>Merchandising performance</h2></div></div><div className="activity-list">{(data.collections||[]).map((row:any)=><div className="activity-item" key={row.id}><span>•</span><div><b>{row.title}</b><p>{row.units} units</p></div><strong>{money(row.revenue)}</strong></div>)}{!(data.collections||[]).length&&<div className="activity-item"><span>•</span><div><b>No collection sales yet</b></div></div>}</div></article>
    </section>

    <section className="enterprise-grid two" style={{marginTop:14}}>
      <article className="panel enterprise-card"><h3>Sales by location</h3>{(data.locations||[]).map((row:any)=><div className="metric-row" key={row.name}><span>{row.name} · {row.orders} orders</span><b>{money(row.revenue)}</b></div>)}</article>
      <article className="panel enterprise-card"><h3>Sales by channel</h3>{(data.channels||[]).map((row:any)=><div className="metric-row" key={row.channel}><span>{row.channel} · {row.orders} orders</span><b>{money(row.revenue)}</b></div>)}</article>
    </section>
  </>;
}
