"use server";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";

const apiBase=(process.env.NEXT_PUBLIC_API_URL||"https://e-commerce-admin-dashboard-ptgs.onrender.com").replace(/\/$/,"");

export type LoginState={status:"idle"|"error";message:string;field?:"email"|"password"};

async function warmApi(){
  try{
    await fetch(apiBase+"/health",{
      cache:"no-store",
      signal:AbortSignal.timeout(45000),
    });
  }catch{}
}

async function postLogin(email:string,password:string,timeoutMs:number){
  return fetch(apiBase+"/v1/admin/auth/login",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({email,password}),
    cache:"no-store",
    signal:AbortSignal.timeout(timeoutMs),
  });
}

export async function loginAction(_previous:LoginState,formData:FormData):Promise<LoginState>{
  const email=String(formData.get("email")||"").trim().toLowerCase();
  const password=String(formData.get("password")||"");

  if(!email||!email.includes("@")) return {status:"error",message:"Enter a valid email address.",field:"email"};
  if(password.length<10) return {status:"error",message:"Password must be at least 10 characters.",field:"password"};

  await warmApi();

  let response:Response;
  try{
    response=await postLogin(email,password,30000);
  }catch{
    await warmApi();
    try{
      response=await postLogin(email,password,30000);
    }catch{
      return {status:"error",message:"The commerce API is still waking up. Please wait a few seconds and try again."};
    }
  }

  if(!response.ok){
    if(response.status===429) return {status:"error",message:"Too many sign-in attempts. Please try again shortly."};
    if(response.status>=500) return {status:"error",message:"The commerce API is temporarily unavailable. Please try again in a moment."};
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
