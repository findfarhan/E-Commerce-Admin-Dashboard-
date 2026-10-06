import "server-only";
import {requireAdminPermission,requireAdminSession} from "./admin-server-session";

const apiBase=(process.env.NEXT_PUBLIC_API_URL||"https://e-commerce-admin-dashboard-ptgs.onrender.com").replace(/\/$/,"");

export async function adminMutation<T=any>(path:string,init:RequestInit={},permission?:string):Promise<T>{
  const session=permission?await requireAdminPermission(permission):await requireAdminSession();
  const adminKey=process.env.ADMIN_API_KEY;
  if(!adminKey) throw new Error("ADMIN_API_KEY is not configured on the Admin Vercel project.");
  const response=await fetch(apiBase+path,{
    ...init,
    headers:{
      "Content-Type":"application/json",
      "X-Admin-Key":adminKey,
      "X-Admin-Actor":session.email,
      "X-Admin-Role":session.role,
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
