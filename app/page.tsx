import Link from "next/link";
import {PageHeader} from "@/components/page-header";
import {StatusPill} from "@/components/status-pill";
import {getAdminDashboard,getAdminOrders,getAdminProducts} from "@/lib/admin-api";
import {pipeline,recentEvents,storefrontHealth} from "@/lib/mock-data";

const money=(n:number)=>"Rs. "+n.toLocaleString("en-PK");

export default async function Dashboard(){
  const [summary,orders,products]=await Promise.all([
    getAdminDashboard(),
    getAdminOrders(),
    getAdminProducts(),
  ]);

  return <>
    <PageHeader eyebrow="JEWELRY STORE / LIVE" title="Command Center" description="Orders, customers, catalog health, storefront infrastructure and CRM activity in one place.">
      <Link className="secondary-button" href="/storefront">Storefront</Link>
      <Link className="primary-button" href="/products">Manage catalog</Link>
    </PageHeader>

    <section className="store-focus-banner">
      <div><b>{summary.name}</b><p>{summary.domain} · Render API + Supabase Postgres</p></div>
      <span>{summary.source==="api"?"LIVE DATA":"FALLBACK DATA"}</span>
    </section>

    <section className="stats-grid">
      <article className="stat-card"><div className="stat-card-top"><span>REVENUE TODAY</span><em>Live</em></div><strong>{money(Number(summary.revenue_today||0))}</strong><small>Paid orders today</small></article>
      <article className="stat-card"><div className="stat-card-top"><span>ORDERS</span><em>Today</em></div><strong>{Number(summary.orders_today||0)}</strong><small>{orders.length} visible records</small></article>
      <article className="stat-card"><div className="stat-card-top"><span>CUSTOMERS</span><em>CRM</em></div><strong>{Number(summary.customers||0).toLocaleString()}</strong><small>Known customer profiles</small></article>
      <article className="stat-card"><div className="stat-card-top"><span>CATALOG</span><em>Active</em></div><strong>{Number(summary.products||products.length)}</strong><small>{Number(summary.low_stock_variants||0)} low-stock variants</small></article>
    </section>

    <section className="dashboard-grid">
      <article className="panel">
        <div className="panel-head"><div><span>RECENT ORDERS</span><h2>Latest activity</h2></div><Link href="/orders">View all</Link></div>
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>ORDER</th><th>CUSTOMER</th><th>STATUS</th><th className="right">TOTAL</th></tr></thead>
          <tbody>
            {orders.slice(0,5).map(o=><tr key={o.id}><td className="order-id">{o.number}</td><td><b>{o.customer}</b><small>{o.email}</small></td><td><StatusPill tone={o.status==="fulfilled"||o.status==="paid"?"success":o.status==="pending"?"warning":"neutral"}>{o.status}</StatusPill></td><td className="right">{money(o.total)}</td></tr>)}
            {!orders.length&&<tr><td colSpan={4}>No orders yet.</td></tr>}
          </tbody>
        </table></div>
      </article>

      <article className="panel">
        <div className="panel-head"><div><span>CRM PIPELINE</span><h2>Customer segments</h2></div></div>
        <div className="pipeline">{pipeline.map(x=><div className="pipeline-row" key={x.label}><span>{x.label}</span><div className="pipeline-track"><i style={{width:Math.min(100,x.value/1.8)+"%"}}/></div><b>{x.value}</b></div>)}</div>
      </article>
    </section>

    <section className="dashboard-grid lower">
      <article className="panel">
        <div className="panel-head"><div><span>ACTIVITY</span><h2>Operational timeline</h2></div></div>
        <div className="activity-list">{recentEvents.map((e,i)=><div className="activity-item" key={i}><span>•</span><div><b>{e.title}</b><p>{e.text}</p></div><time>{e.time}</time></div>)}</div>
      </article>
      <article className="panel">
        <div className="panel-head"><div><span>INFRASTRUCTURE</span><h2>Storefront health</h2></div><span className="free-tier-chip">{Number(summary.queued_jobs||0)} queued jobs</span></div>
        <div className="health-grid">{storefrontHealth.map(h=><div className="health-card" key={h.label}><span>{h.label}<StatusPill tone={h.tone}>{h.value}</StatusPill></span><b>{h.value}</b><small>{h.detail}</small></div>)}</div>
      </article>
    </section>
  </>;
}
