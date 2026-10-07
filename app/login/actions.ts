"use server";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";

const apiBase=(process.env.NEXT_PUBLIC_API_URL||"https://e-commerce-admin-dashboard-ptgs.onrender.com").replace(/\/$/,"");

export type LoginState={status:"idle"|"error";message:string;field?:"email"|"password"};

export async function loginAction(_previous:LoginState,formData:FormData):Promise<LoginState>{
  const email=String(formData.get("email")||"").trim().toLowerCase();
  const password=String(formData.get("password")||"");

  if(!email||!email.includes("@")) return {status:"error",message:"Enter a valid email address.",field:"email"};
  if(password.length<10) return {status:"error",message:"Password must be at least 10 characters.",field:"password"};

  let response:Response;
  try{
    response=await fetch(apiBase+"/v1/admin/auth/login",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({email,password}),
      cache:"no-store",
      signal:AbortSignal.timeout(15000),
    });
  }catch{
    return {status:"error",message:"The admin service is temporarily unreachable. Please try again."};
  }

  if(!response.ok){
    if(response.status===429) return {status:"error",message:"Too many sign-in attempts. Please try again shortly."};
    return {status:"error",message:"The email or password you entered is incorrect."};
  }

  const result=await response.json();
  if(!result?.token) return {status:"error",message:"Sign-in completed without a valid session. Please try again."};

  const jar=await cookies();
  jar.set("jc_session",result.token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:8*60*60});
  redirect("/");
}

export async function logoutAction(){
  const jar=await cookies();
  jar.set("jc_session","",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:0});
  redirect("/login");
}
