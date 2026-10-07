import Link from "next/link";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {StatusPill} from "@/components/status-pill";
import {getAdminDashboard,getAdminOrders,getAdminProducts} from "@/lib/admin-api";

const money=(n:number)=>"Rs. "+Math.round(n).toLocaleString("en-PK");
const initials=(name:string)=>name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join("")||"G";

function MetricIcon({type}:{type:"revenue"|"orders"|"customers"|"catalog"}){
  const common={viewBox:"0 0 24 24","aria-hidden":true};
  if(type==="revenue") return <svg {...common}><path d="M12 3v18M16.5 7.2c0-1.8-1.9-3.2-4.5-3.2S7.5 5.2 7.5 7s1.5 2.6 4.5 3 4.5 1.1 4.5 3-1.8 3-4.5 3-4.8-1.3-4.8-3.4"/></svg>;
  if(type==="orders") return <svg {...common}><path d="M6 3h12l1 18H5L6 3Z"/><path d="M9 8a3 3 0 0 0 6 0"/></svg>;
  if(type==="customers") return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3.5 20c.4-4 2.2-6 5.5-6s5.1 2 5.5 6"/><path d="M16 6.5a2.5 2.5 0 0 1 0 5M17 14c2.1.6 3.3 2.3 3.5 5"/></svg>;
  return <svg {...common}><path d="M4 7 12 3l8 4-8 4-8-4Z"/><path d="m4 12 8 4 8-4M4 17l8 4 8-4"/></svg>;
}

export default async function Dashboard(){
  const jar=await cookies();
  if(!jar.get("jc_session")?.value) redirect("/login");

  const [summary,orders,products]=await Promise.all([
    getAdminDashboard(),
    getAdminOrders(),
    getAdminProducts(),
  ]);

  const totalVisibleRevenue=orders.reduce((sum,o)=>sum+Number(o.total||0),0);
  const pendingOrders=orders.filter(o=>!["completed","canceled","cancelled","refunded"].includes(String(o.status).toLowerCase())).length;
  const activeProducts=products.filter(p=>String(p.status).toLowerCase()==="active").length;
  const lowStock=Number(summary.low_stock_variants||0);
  const catalogHealth=activeProducts?Math.max(0,Math.round(((activeProducts-Math.min(activeProducts,lowStock))/activeProducts)*100)):100;
  const recentOrders=orders.slice(0,6);
  const activity=(summary.recent_activity||[]).slice(0,5);

  const signals=[
    {label:"Low stock",value:lowStock,href:"/inventory",meta:"Variants requiring attention",tone:lowStock>0?"warning":"success"},
    {label:"Open checkouts",value:Number(summary.open_checkouts||0),href:"/orders",meta:"Active checkout sessions",tone:"info"},
    {label:"Commissions",value:Number(summary.new_commissions||0),href:"/commissions",meta:"New custom requests",tone:"neutral"},
    {label:"Audience",value:Number(summary.subscribers||0),href:"/audience",meta:"Newsletter subscribers",tone:"neutral"},
  ];

  return <div className="dash-shell">
    <header className="dash-hero">
      <div>
        <div className="dash-eyebrow"><span className="dash-live-dot"/> LIVE COMMERCE OVERVIEW</div>
        <h1>Good to see you.</h1>
        <p>Here is what is happening across <b>{summary.name||"Jewelry Store"}</b> right now.</p>
      </div>
      <div className="dash-hero-actions">
        <Link href="/orders/new" className="dash-button secondary">Create order</Link>
        <Link href="/products/new" className="dash-button primary">
          <span>＋</span> Add product
        </Link>
      </div>
    </header>

    <section className="dash-store-strip">
      <div className="dash-store-identity">
        <span className="dash-store-logo">JC</span>
        <div>
          <b>{summary.name||"Jewelry Store"}</b>
          <small>{summary.domain||"Production storefront"}</small>
        </div>
      </div>
      <div className="dash-store-meta">
        <span><i className="ok"/>API healthy</span>
        <span><i className="ok"/>Database connected</span>
        <span>PKR · Asia/Karachi</span>
      </div>
      <Link href="/storefront">View storefront ↗</Link>
    </section>

    <section className="dash-metrics">
      <article className="dash-metric">
        <div className="dash-metric-head"><span className="dash-metric-icon"><MetricIcon type="revenue"/></span><small>TODAY</small></div>
        <span>Revenue</span>
        <strong>{money(Number(summary.revenue_today||0))}</strong>
        <p>Paid commerce revenue today</p>
      </article>
      <article className="dash-metric">
        <div className="dash-metric-head"><span className="dash-metric-icon"><MetricIcon type="orders"/></span><small>{pendingOrders} OPEN</small></div>
        <span>Orders today</span>
        <strong>{Number(summary.orders_today||0).toLocaleString()}</strong>
        <p>{orders.length} orders currently visible</p>
      </article>
      <article className="dash-metric">
        <div className="dash-metric-head"><span className="dash-metric-icon"><MetricIcon type="customers"/></span><small>CRM</small></div>
        <span>Customers</span>
        <strong>{Number(summary.customers||0).toLocaleString()}</strong>
        <p>Known customer profiles</p>
      </article>
      <article className="dash-metric">
        <div className="dash-metric-head"><span className="dash-metric-icon"><MetricIcon type="catalog"/></span><small>{catalogHealth}% HEALTH</small></div>
        <span>Active catalog</span>
        <strong>{activeProducts.toLocaleString()}</strong>
        <p>{lowStock} low-stock variants</p>
      </article>
    </section>

    <section className="dash-main-grid">
      <article className="dash-card dash-orders-card">
        <div className="dash-card-head">
          <div><span>RECENT ORDERS</span><h2>Latest sales activity</h2><p>Most recent orders across the storefront and admin.</p></div>
          <Link href="/orders">View all orders</Link>
        </div>
        <div className="dash-order-table">
          <div className="dash-order-row dash-order-header"><span>Order</span><span>Customer</span><span>Status</span><span>Payment</span><span>Total</span></div>
          {recentOrders.map(o=><Link href={"/orders/"+o.id} className="dash-order-row" key={o.id}>
            <span className="dash-order-number"><b>{o.number}</b><small>{o.createdAt||"Recent order"}</small></span>
            <span className="dash-customer"><i>{initials(o.customer)}</i><span><b>{o.customer}</b><small>{o.email||"No email"}</small></span></span>
            <span><StatusPill tone={["completed","fulfilled"].includes(String(o.status).toLowerCase())?"success":["canceled","cancelled"].includes(String(o.status).toLowerCase())?"neutral":"warning"}>{o.status}</StatusPill></span>
            <span><StatusPill tone={String(o.paymentStatus).toLowerCase()==="paid"?"success":"info"}>{o.paymentStatus||"pending"}</StatusPill></span>
            <span className="dash-order-total">{money(o.total)}</span>
          </Link>)}
          {!recentOrders.length&&<div className="dash-empty">No orders yet. New orders will appear here automatically.</div>}
        </div>
      </article>

      <aside className="dash-side-stack">
        <article className="dash-card dash-actions-card">
          <div className="dash-card-head compact"><div><span>QUICK ACTIONS</span><h2>Run your store</h2></div></div>
          <div className="dash-quick-actions">
            <Link href="/orders/new"><i>＋</i><span><b>Create manual order</b><small>Build an order for a customer</small></span><em>→</em></Link>
            <Link href="/products/new"><i>◇</i><span><b>Add new product</b><small>Catalog, variants and pricing</small></span><em>→</em></Link>
            <Link href="/collections/new"><i>⌘</i><span><b>Create collection</b><small>Manual or merchandising group</small></span><em>→</em></Link>
            <Link href="/discounts"><i>%</i><span><b>Manage discounts</b><small>Codes and automatic offers</small></span><em>→</em></Link>
          </div>
        </article>

        <article className="dash-card dash-health-card">
          <div className="dash-card-head compact"><div><span>CATALOG HEALTH</span><h2>{catalogHealth}% healthy</h2></div><Link href="/inventory">Review</Link></div>
          <div className="dash-health-meter"><i style={{width:catalogHealth+"%"}}/></div>
          <div className="dash-health-stats">
            <div><b>{activeProducts}</b><span>Active products</span></div>
            <div><b>{lowStock}</b><span>Low stock</span></div>
            <div><b>{products.reduce((n,p)=>n+Number(p.variantCount||0),0)}</b><span>Variants</span></div>
          </div>
        </article>
      </aside>
    </section>

    <section className="dash-bottom-grid">
      <article className="dash-card">
        <div className="dash-card-head">
          <div><span>STORE SIGNALS</span><h2>Needs your attention</h2><p>Operational items worth checking today.</p></div>
        </div>
        <div className="dash-signal-grid">
          {signals.map(s=><Link href={s.href} className={"dash-signal "+s.tone} key={s.label}>
            <span>{s.label}</span><b>{s.value.toLocaleString()}</b><small>{s.meta}</small><em>Open →</em>
          </Link>)}
        </div>
      </article>

      <article className="dash-card">
        <div className="dash-card-head">
          <div><span>RECENT ACTIVITY</span><h2>Operational timeline</h2><p>Live events from your commerce system.</p></div>
          <Link href="/audit">Audit log</Link>
        </div>
        <div className="dash-timeline">
          {activity.map((event:any,index:number)=><div className="dash-timeline-row" key={event.kind+"-"+event.created_at+"-"+index}>
            <i/>
            <div><b>{String(event.event_type||event.kind||"Activity").replaceAll("."," / ")}</b><p>{event.message||"Commerce activity recorded"}</p></div>
            <time>{event.created_at?new Date(event.created_at).toLocaleString("en-PK",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"Now"}</time>
          </div>)}
          {!activity.length&&<div className="dash-empty slim">No recent activity yet.</div>}
        </div>
      </article>
    </section>

    <footer className="dash-footer-note">
      <span><i className="ok"/> Live data from Supabase</span>
      <span>{orders.length?money(totalVisibleRevenue)+" across visible orders":"No order revenue yet"}</span>
    </footer>
  </div>;
}
