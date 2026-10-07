"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {ThemeToggle} from "./theme-toggle";
import {LiveDataPulse} from "./live-data-pulse";

const titles:Record<string,string>={
  "/":"Command Center","/commerce":"Commerce","/orders":"Orders","/draft-orders":"Draft Orders","/customers":"Customers",
  "/products":"Products","/collections":"Collections","/inventory":"Inventory","/discounts":"Discounts","/shipping-tax":"Shipping & Tax",
  "/purchasing":"Purchasing","/returns":"Returns","/analytics":"Analytics","/settings":"Settings"
};

export function Topbar(){
  const pathname=usePathname();
  const root="/"+pathname.split("/").filter(Boolean)[0];
  const title=pathname==="/"?titles["/"]:(titles[root]||"Jewelry Control");
  return <header className="topbar professional-topbar">
    <div className="topbar-context">
      <small>JEWELRY STORE</small>
      <div><b>{title}</b><span>/</span><em>Production</em></div>
    </div>
    <div className="topbar-actions">
      <LiveDataPulse/>
      <label className="global-search"><span>⌕</span><input placeholder="Search orders, customers, products..."/><kbd>⌘K</kbd></label>
      <ThemeToggle/>
      <Link className="topbar-order-button" href="/orders/new">New order</Link>
      <Link className="create-button" href="/products/new">＋ Product</Link>
    </div>
  </header>;
}
