import "server-only";

const apiBase=(process.env.NEXT_PUBLIC_API_URL||"https://e-commerce-admin-dashboard-ptgs.onrender.com").replace(/\/$/,"");

export async function adminMutation<T=any>(path:string,init:RequestInit={}):Promise<T>{
  const adminKey=process.env.ADMIN_API_KEY;
  if(!adminKey) throw new Error("ADMIN_API_KEY is not configured on the Admin Vercel project.");
  const response=await fetch(apiBase+path,{
    ...init,
    headers:{
      "Content-Type":"application/json",
      "X-Admin-Key":adminKey,
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
