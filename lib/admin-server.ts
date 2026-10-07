import "server-only";
import {cookies} from "next/headers";

const apiBase=(process.env.NEXT_PUBLIC_API_URL||"https://e-commerce-admin-dashboard-ptgs.onrender.com").replace(/\/$/,"");

export async function adminMutation<T=any>(path:string,init:RequestInit={}):Promise<T>{
  const jar=await cookies();
  const token=jar.get("jc_session")?.value;
  const adminKey=process.env.ADMIN_API_KEY;
  if(!token&&!adminKey) throw new Error("Admin authentication is not configured.");
  const authHeaders:Record<string,string>={};
  if(token) authHeaders.Authorization="Bearer "+token;
  else if(adminKey) authHeaders["X-Admin-Key"]=adminKey;
  const response=await fetch(apiBase+path,{
    ...init,
    headers:{
      "Content-Type":"application/json",
      ...authHeaders,
      ...(init.headers||{}),
    },
    cache:"no-store",
  });
  if(!response.ok){
    const body=await response.text();
    throw new Error(body||("Admin API request failed with "+response.status));
  }
  return response.json() as Promise<T>;
}
