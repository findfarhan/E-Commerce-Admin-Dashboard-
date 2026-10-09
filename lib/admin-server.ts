import "server-only";
import {cookies} from "next/headers";

const apiBase=(process.env.NEXT_PUBLIC_API_URL||"https://e-commerce-admin-dashboard-ptgs.onrender.com").replace(/\/$/,"");

export async function adminMutation<T=any>(path:string,init:RequestInit={}):Promise<T>{
  const jar=await cookies();
  const token=jar.get("jc_session")?.value;
  // Staff mutations must never use an environment-wide admin key as fallback.
  if(!token) throw new Error("Authenticated staff session is required.");
  const authHeaders:Record<string,string>={Authorization:"Bearer "+token};
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
