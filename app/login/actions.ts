"use server";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";

const apiBase=(process.env.NEXT_PUBLIC_API_URL||"https://e-commerce-admin-dashboard-ptgs.onrender.com").replace(/\/$/,"");

export async function loginAction(formData:FormData){
  const email=String(formData.get("email")||"").trim().toLowerCase();
  const password=String(formData.get("password")||"");
  const response=await fetch(apiBase+"/v1/admin/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password}),cache:"no-store"});
  if(!response.ok) redirect("/login?error=invalid");
  const result=await response.json();
  const jar=await cookies();
  jar.set("jc_session",result.token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:8*60*60});
  redirect("/");
}
export async function logoutAction(){
  const jar=await cookies();jar.set("jc_session","",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:0});redirect("/login");
}
