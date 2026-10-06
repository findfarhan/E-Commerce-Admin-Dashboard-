"use client";
import Link from "next/link";
import {ThemeToggle} from "./theme-toggle";
import {LiveDataPulse} from "./live-data-pulse";

export function Topbar(){
  return <header className="topbar">
    <div className="store-switcher">
      <button className="store-switcher-button">
        <span className="store-switcher-icon">◇</span>
        <span className="store-switcher-copy"><small>ACTIVE STOREFRONT</small><b>Jewelry Store</b></span>
      </button>
    </div>
    <div className="topbar-actions">
      <LiveDataPulse/>
      <label className="global-search"><span>⌕</span><input placeholder="Search orders, customers, products..."/><kbd>⌘K</kbd></label>
      <ThemeToggle/>
      <Link className="create-button" href="/products/new">+ Create</Link>
    </div>
  </header>;
}
