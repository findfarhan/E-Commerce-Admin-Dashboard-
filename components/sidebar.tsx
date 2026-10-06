"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {logoutAction} from "@/app/login/actions";

const groups=[
  {label:"COMMERCE",items:[["/","Command Center"],["/orders","Orders"],["/draft-orders","Drafts / Quotes"],["/returns","Returns"],["/payments","Payments"]]},
  {label:"CUSTOMERS",items:[["/customers","Customers"],["/commissions","Commissions"],["/audience","Audience"],["/inbox","Inbox"]]},
  {label:"CATALOG",items:[["/products","Products"],["/collections","Collections"],["/inventory","Inventory"],["/purchasing","Purchasing"]]},
  {label:"GROWTH",items:[["/discounts","Discounts"],["/shipping","Shipping & Tax"],["/analytics","Analytics"],["/channels","Channels"],["/storefront","Storefront"],["/seo","SEO / Discovery"]]},
  {label:"SYSTEM",items:[["/notifications","Notifications"],["/audit","Audit Log"],["/automations","Automations"],["/team","Team & Roles"],["/settings","Settings"]]},
];
export function Sidebar(){
  const p=usePathname();
  return <aside className="sidebar">
    <Link href="/" className="admin-brand"><span>JC</span><div><b>JEWELRY CONTROL</b><small>ENTERPRISE COMMERCE OS</small></div></Link>
    <nav className="sidebar-nav enterprise-nav">
      {groups.map(group=><div className="nav-group" key={group.label}><small>{group.label}</small>{group.items.map(([href,label])=><Link key={href} href={href} className={p===href||href!=="/"&&p.startsWith(href+"/")?"active":""}><span>{label}</span></Link>)}</div>)}
    </nav>
    <div className="sidebar-foot">
      <div className="infra-state"><i className="pulse"/><div><b>Jewelry Store</b><small>Render + Vercel + Supabase</small></div></div>
      <form action={logoutAction}><button className="sidebar-logout" type="submit">Sign out</button></form>
    </div>
  </aside>;
}
