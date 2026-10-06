import {PageHeader} from "@/components/page-header";
import {adminRequest} from "@/lib/admin-api";
const money=(value:number)=>"Rs. "+Math.round(Number(value||0)).toLocaleString("en-PK");
export default async function Analytics(){
  const [base,report]=await Promise.all([adminRequest<any>("/v1/admin/operations/analytics",0),adminRequest<any>("/v1/admin/commerce/report",0)]);
  if(!base||!report) throw new Error("Live analytics unavailable.");
  const max=Math.max(1,...(base.daily||[]).map((day:any)=>Number(day.revenue||0)));
  return <><PageHeader eyebrow="ANALYTICS / LIVE" title="Store performance" description="Revenue, margin, product, variant, inventory, customer, channel, collection and location performance from live commerce data."/>
  <section className="stats-grid">
    <article className="stat-card"><span>30D REVENUE</span><strong>{money(report.revenue)}</strong><small>{report.orders} orders</small></article>
    <article className="stat-card"><span>GROSS PROFIT</span><strong>{money(report.gross_profit)}</strong><small>{report.gross_margin}% margin</small></article>
    <article className="stat-card"><span>AOV</span><strong>{money(report.aov)}</strong><small>{report.customers} customers</small></article>
    <article className="stat-card"><span>CHECKOUT → ORDER</span><strong>{report.checkout_conversion}%</strong><small>{report.repeat_customers} repeat customers</small></article>
  </section>
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