"use server";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {ADMIN_SESSION_COOKIE,signAdminSession} from "@/lib/admin-session";

const apiBase=(process.env.NEXT_PUBLIC_API_URL||"https://e-commerce-admin-dashboard-ptgs.onrender.com").replace(/\/$/,"");

async function api(path:string,body:any){
  const adminKey=process.env.ADMIN_API_KEY;
  if(!adminKey) throw new Error("ADMIN_API_KEY is not configured.");
  const response=await fetch(apiBase+path,{
    method:"POST",
    headers:{"Content-Type":"application/json","X-Admin-Key":adminKey},
    body:JSON.stringify(body),
    cache:"no-store",
  });
  const text=await response.text();
  let data:any={};
  try{data=text?JSON.parse(text):{};}catch{data={message:text};}
  return {ok:response.ok,status:response.status,data};
}

export async function loginAction(_state:{error?:string}|undefined,formData:FormData){
  const username=String(formData.get("username")||"").trim();
  const password=String(formData.get("password")||"");
  if(!username||!password) return {error:"Username/email and password are required."};

  let result=await api("/v1/admin/auth/login",{username,password});
  if(!result.ok&&[401,404].includes(result.status)){
    const legacyUser=process.env.ADMIN_UI_USERNAME||"";
    const legacyPassword=process.env.ADMIN_UI_PASSWORD||"";
    if(username===legacyUser&&password===legacyPassword&&legacyUser&&legacyPassword){
      const bootstrap=await api("/v1/admin/auth/bootstrap",{username,password,displayName:"Owner"});
      if(bootstrap.ok||bootstrap.status===409) result=await api("/v1/admin/auth/login",{username,password});
    }
  }

  if(!result.ok) return {error:result.status===401?"Invalid credentials.":String(result.data?.message||"Login failed.")};
  const user=result.data;
  const now=Date.now();
  const token=await signAdminSession({
    sub:String(user.id),
    email:String(user.email||username),
    displayName:String(user.displayName||user.email||username),
    role:String(user.role?.slug||"staff"),
    permissions:Array.isArray(user.role?.permissions)?user.role.permissions.map(String):[],
    exp:now+8*60*60*1000,
  });
  const jar=await cookies();
  jar.set(ADMIN_SESSION_COOKIE,token,{
    httpOnly:true,
    sameSite:"lax",
    secure:process.env.NODE_ENV==="production",
    path:"/",
    maxAge:8*60*60,
  });
  redirect("/");
}

export async function logoutAction(){
  const jar=await cookies();
  jar.set(ADMIN_SESSION_COOKIE,"",{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:0});
  redirect("/login");
}
