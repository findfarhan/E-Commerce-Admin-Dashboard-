"use client";
import {usePathname} from "next/navigation";
import {Sidebar} from "./sidebar";
import {Topbar} from "./topbar";

export function AppShell({children}:{children:React.ReactNode}){
  const pathname=usePathname();
  if(pathname==="/login"||pathname.startsWith("/login/")||pathname==="/setup"||pathname.startsWith("/setup/")){
    return <>{children}</>;
  }
  return <div className="app-shell"><Sidebar/><div className="app-main"><Topbar/><main className="page-content">{children}</main></div></div>;
}
