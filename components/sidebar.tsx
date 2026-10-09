"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";

const sections=[
  {label:"OVERVIEW",items:[["/","Command Center"],["/commerce","Commerce"]]},
  {label:"SALES",items:[["/orders","Orders"],["/draft-orders","Draft Orders"],["/customers","Customers"],["/returns","Returns"]]},
  {label:"CATALOG",items:[["/products","Products"],["/bundles","Jewelry Bundles"],["/collections","Collections"],["/metafields","Metafields"],["/inventory","Inventory"]]},
  {label:"OPERATIONS",items:[["/shipping-tax","Shipping & Tax"],["/purchasing","Purchasing"],["/discounts","Discounts"],["/affiliates","Affiliates"],["/commissions","Custom Requests"]]},
  {label:"GROWTH",items:[["/audience","Audience"],["/inbox","Inbox"],["/automations","Automations"],["/analytics","Analytics"],["/channels","Channels"],["/storefront","Storefront"],["/seo","SEO / Discovery"]]},
  {label:"SYSTEM",items:[["/audit","Audit / Reports"],["/team","Team"],["/settings","Settings"]]},
];

function NavIcon({href}:{href:string}){
  const props={viewBox:"0 0 24 24","aria-hidden":true};
  if(href==="/")return <svg {...props}><path d="M4 13h6V4H4v9Zm10 7h6V11h-6v9ZM4 20h6v-3H4v3Zm10-13h6V4h-6v3Z"/></svg>;
  if(href.includes("order"))return <svg {...props}><path d="M6 3h12l1 18H5L6 3Z"/><path d="M9 8a3 3 0 0 0 6 0"/></svg>;
  if(href.includes("customer")||href.includes("audience")||href.includes("team"))return <svg {...props}><circle cx="9" cy="8" r="3"/><path d="M3.5 20c.4-4 2.2-6 5.5-6s5.1 2 5.5 6M16 6.5a2.5 2.5 0 0 1 0 5M17 14c2.1.6 3.3 2.3 3.5 5"/></svg>;
  if(href.includes("product")||href.includes("collection")||href.includes("metafield"))return <svg {...props}><path d="M4 7 12 3l8 4-8 4-8-4Z"/><path d="m4 12 8 4 8-4M4 17l8 4 8-4"/></svg>;
  if(href.includes("inventory")||href.includes("purchasing"))return <svg {...props}><path d="M4 6h16v14H4zM8 6V3h8v3M8 11h8"/></svg>;
  if(href.includes("analytics")||href.includes("audit"))return <svg {...props}><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>;
  if(href.includes("settings"))return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A7 7 0 0 0 15 6.2L14.7 3h-4L10 6.2a7 7 0 0 0-1.5.9l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.5.9l.7 3.2h4l.3-3.2a7 7 0 0 0 1.5-.9l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z"/></svg>;
  return <svg {...props}><path d="M5 5h14v14H5z"/><path d="M9 9h6v6H9z"/></svg>;
}

export function Sidebar(){
  const p=usePathname();
  return <aside className="sidebar professional-sidebar">
    <Link href="/" className="admin-brand">
      <span>JC</span>
      <div><b>JEWELRY CONTROL</b><small>COMMERCE OS</small></div>
    </Link>

    <div className="sidebar-scroll">
      {sections.map(section=><div className="sidebar-section" key={section.label}>
        <p>{section.label}</p>
        <nav className="sidebar-nav">
          {section.items.map(([href,label])=>{
            const active=href==="/"?p===href:p===href||p.startsWith(href+"/");
            return <Link key={href} href={href} className={active?"active":""}>
              <NavIcon href={href}/><span>{label}</span>
            </Link>;
          })}
        </nav>
      </div>)}
    </div>

    <div className="sidebar-foot">
      <div className="infra-state"><i className="pulse"/><div><b>Production</b><small>All core systems operational</small></div></div>
      <div className="sidebar-profile compact-profile"><span>FA</span><div><b>Store Owner</b><small>Full access</small></div></div>
    </div>
  </aside>;
}
