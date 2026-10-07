"use server";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";

const apiBase=(process.env.NEXT_PUBLIC_API_URL||"https://e-commerce-admin-dashboard-ptgs.onrender.com").replace(/\/$/,"");

export async function setupOwnerAction(formData:FormData){
  const email=String(formData.get("email")||"").trim().toLowerCase();
  const name=String(formData.get("name")||"").trim();
  const password=String(formData.get("password")||"");
  const confirm=String(formData.get("confirmPassword")||"");
  if(password!==confirm) redirect("/setup?error=password_mismatch");
  const adminKey=process.env.ADMIN_API_KEY;
  if(!adminKey) redirect("/setup?error=configuration");
  const bootstrap=await fetch(apiBase+"/v1/admin/auth/bootstrap",{
    method:"POST",
    headers:{"Content-Type":"application/json","X-Admin-Key":adminKey},
    body:JSON.stringify({email,name,password}),
    cache:"no-store",
  });
  if(!bootstrap.ok){
    const body=await bootstrap.text();
    if(bootstrap.status===400&&body.includes("already complete")) redirect("/login");
    redirect("/setup?error=setup_failed");
  }
  const login=await fetch(apiBase+"/v1/admin/auth/login",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({email,password}),
    cache:"no-store",
  });
  if(!login.ok) redirect("/login?error=invalid");
  const result=await login.json();
  const jar=await cookies();
  jar.set("jc_session",result.token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:8*60*60});
  redirect("/");
}
