"use client";

import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";

export function LiveDataPulse(){
  const router=useRouter();
  const [syncing,setSyncing]=useState(false);
  const [lastSync,setLastSync]=useState<Date|null>(null);

  useEffect(()=>{
    let timer:number|undefined;
    const refresh=()=>{
      if(document.visibilityState!=="visible") return;
      setSyncing(true);
      router.refresh();
      setLastSync(new Date());
      window.setTimeout(()=>setSyncing(false),700);
    };
    timer=window.setInterval(refresh,8000);
    const focus=()=>refresh();
    window.addEventListener("focus",focus);
    return ()=>{
      if(timer) window.clearInterval(timer);
      window.removeEventListener("focus",focus);
    };
  },[router]);

  return <div className={syncing?"live-data-pulse syncing":"live-data-pulse"} title={lastSync?"Last sync "+lastSync.toLocaleTimeString():"Live Supabase data"}>
    <i/>
    <span>{syncing?"SYNCING":"LIVE DB"}</span>
  </div>;
}
