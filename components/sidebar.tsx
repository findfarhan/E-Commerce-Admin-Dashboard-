"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
const items=[
  ["/","Command Center"],["/commerce","Commerce"],["/orders","Orders"],["/draft-orders","Draft Orders"],["/customers","Customers"],
  ["/products","Products"],["/metafields","Metafields"],["/collections","Collections"],["/inventory","Inventory"],
  ["/discounts","Discounts"],["/shipping-tax","Shipping & Tax"],["/purchasing","Purchasing"],["/returns","Returns"],
  ["/commissions","Commissions"],["/audience","Audience"],["/inbox","Inbox"],["/automations","Automations"],["/analytics","Analytics"],
  ["/channels","Channels"],["/storefront","Storefront"],["/seo","SEO / Discovery"],["/audit","Audit / Reports"],["/team","Team"],["/settings","Settings"]
];
export function Sidebar(){const p=usePathname();return <aside className="sidebar"><Link href="/" className="admin-brand"><span>JC</span><div><b>JEWELRY CONTROL</b><small>STORE OPERATING SYSTEM</small></div></Link><nav className="sidebar-nav">{items.map(([href,label])=><Link key={href} href={href} className={p===href||p.startsWith(href+"/")?"active":""}><span>{label}</span></Link>)}</nav><div className="sidebar-foot"><div className="infra-state"><i className="pulse"/><div><b>Jewelry Store</b><small>Render + Vercel + Supabase</small></div></div><div className="render-free-note">Enterprise commerce core · single-store mode</div></div></aside>}