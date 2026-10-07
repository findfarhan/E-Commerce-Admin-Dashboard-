import Link from "next/link";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {PageHeader} from "@/components/page-header";
import {StatusPill} from "@/components/status-pill";
import {getAdminDashboard,getAdminOrders,getAdminProducts} from "@/lib/admin-api";

const money=(n:number)=>"Rs. "+n.toLocaleString("en-PK");

export default async function Dashboard(){
  const jar=await cookies();
  if(!jar.get("jc_session")?.value) redirect("/login");

  const [summary,orders,products]=await Promise.all([
    getAdminDashboard(),
    getAdminOrders(),
    getAdminProducts(),
  ]);

  const signals=[
    {label:"NEW COMMISSIONS",value:Number(summary.new_commissions||0),href:"/commissions",detail:"Private-lab requests waiting for review"},
    {label:"AUDIENCE",value:Number(summary.subscribers||0),href:"/audience",detail:"Active private-frequency subscribers"},
    {label:"OPEN CHECKOUTS",value:Number(summary.open_checkouts||0),href:"/orders",detail:"Unexpired server-priced checkout sessions"},
    {label:"LOW STOCK",value:Number(summary.low_stock_variants||0),href:"/products",detail:"Active variants at 3 units or below"},
  ];

  const infrastructure=[
    {label:"RENDER API",value:"LIVE",tone:"success" as const,detail:"NestJS commerce API"},
    {label:"SUPABASE DB",value:"LIVE",tone:"success" as const,detail:"Canonical PostgreSQL commerce data"},
    {label:"CHECKOUT",value:"COD",tone:"success" as const,detail:"Server-priced atomic order flow"},
    {label:"MEDIA",value:"DEFERRED",tone:"neutral" as const,detail:"Cloudflare integration intentionally postponed"},
  ];

  return <>
    <PageHeader eyebrow="JEWELRY STORE / LIVE" title="Command Center" description="Orders, customers, catalog health, storefront activity and CRM signals from the live commerce database.">
      <Link className="secondary-button" href="/storefront">Storefront</Link>
      <Link className="primary-button" href="/products">Manage catalog</Link>
    </PageHeader>

    <section className="store-focus-banner">
      <div><b>{summary.name}</b><p>{summary.domain} · Render API + Supabase Postgres</p></div>
      <span>LIVE DATA</span>
    </section>

    <section className="stats-grid">
      <article className="stat-card"><div className="stat-card-top"><span>REVENUE TODAY</span><em>Live</em></div><strong>{money(Number(summary.revenue_today||0))}</strong><small>Paid orders today</small></article>
      <article className="stat-card"><div className="stat-card-top"><span>ORDERS</span><em>Today</em></div><strong>{Number(summary.orders_today||0)}</strong><small>{orders.length} total visible records</small></article>
      <article className="stat-card"><div className="stat-card-top"><span>CUSTOMERS</span><em>CRM</em></div><strong>{Number(summary.customers||0).toLocaleString()}</strong><small>Known customer profiles</small></article>
      <article className="stat-card"><div className="stat-card-top"><span>CATALOG</span><em>Active</em></div><strong>{Number(summary.products||products.length)}</strong><small>{Number(summary.low_stock_variants||0)} low-stock variants</small></article>
    </section>

    <section className="dashboard-grid">
      <article className="panel">
        <div className="panel-head"><div><span>RECENT ORDERS</span><h2>Latest commerce activity</h2></div><Link href="/orders">View all</Link></div>
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>ORDER</th><th>CUSTOMER</th><th>STATUS</th><th className="right">TOTAL</th></tr></thead>
          <tbody>
            {orders.slice(0,5).map(o=><tr key={o.id}><td className="order-id"><Link href={"/orders/"+o.id}><b>{o.number}</b></Link></td><td><b>{o.customer}</b><small>{o.email}</small></td><td><StatusPill tone={o.status==="completed"?"success":o.status==="canceled"?"neutral":"warning"}>{o.status}</StatusPill></td><td className="right">{money(o.total)}</td></tr>)}
            {!orders.length&&<tr><td colSpan={4}>No orders yet.</td></tr>}
          </tbody>
        </table></div>
      </article>

      <article className="panel">
        <div className="panel-head"><div><span>STORE SIGNALS</span><h2>Needs attention</h2></div></div>
        <div className="health-grid">
          {signals.map(signal=><Link className="health-card" href={signal.href} key={signal.label}><span>{signal.label}</span><b>{signal.value}</b><small>{signal.detail}</small></Link>)}
        </div>
      </article>
    </section>

    <section className="dashboard-grid lower">
      <article className="panel">
        <div className="panel-head"><div><span>ACTIVITY</span><h2>Live operational timeline</h2></div></div>
        <div className="activity-list">
          {(summary.recent_activity||[]).map((event:any,index:number)=><div className="activity-item" key={event.kind+"-"+event.created_at+"-"+index}><span>•</span><div><b>{String(event.event_type||event.kind).replaceAll("."," / ")}</b><p>{event.message}</p></div><time>{new Date(event.created_at).toLocaleString("en-PK")}</time></div>)}
          {!(summary.recent_activity||[]).length&&<div className="activity-item"><span>•</span><div><b>Awaiting live activity</b><p>Orders and commission events will appear here automatically.</p></div></div>}
        </div>
      </article>

      <article className="panel">
        <div className="panel-head"><div><span>INFRASTRUCTURE</span><h2>Runtime state</h2></div><span className="free-tier-chip">{Number(summary.queued_jobs||0)} queued jobs</span></div>
        <div className="health-grid">{infrastructure.map(item=><div className="health-card" key={item.label}><span>{item.label}<StatusPill tone={item.tone}>{item.value}</StatusPill></span><b>{item.value}</b><small>{item.detail}</small></div>)}</div>
      </article>
    </section>
  </>;
}
