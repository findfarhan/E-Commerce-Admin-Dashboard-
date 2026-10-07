"use client";

import {useActionState,useEffect,useState} from "react";
import {useFormStatus} from "react-dom";
import {loginAction,type LoginState} from "./actions";

const initialState:LoginState={status:"idle",message:""};
const apiBase=(process.env.NEXT_PUBLIC_API_URL||"https://e-commerce-admin-dashboard-ptgs.onrender.com").replace(/\/$/,"");

function SubmitButton(){
  const {pending}=useFormStatus();
  return <button className="login-submit" type="submit" disabled={pending}>
    <span>{pending?"Signing in…":"Sign in to dashboard"}</span>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
  </button>;
}

export default function LoginForm(){
  const [state,action]=useActionState(loginAction,initialState);
  const [showPassword,setShowPassword]=useState(false);
  const [serviceState,setServiceState]=useState<"warming"|"ready"|"offline">("warming");

  useEffect(()=>{
    let cancelled=false;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),60000);
    fetch(apiBase+"/health",{cache:"no-store",signal:controller.signal,mode:"no-cors"})
      .then(()=>{if(!cancelled)setServiceState("ready");})
      .catch(()=>{if(!cancelled)setServiceState("offline");})
      .finally(()=>clearTimeout(timer));
    return()=>{cancelled=true;clearTimeout(timer);controller.abort();};
  },[]);

  return <form action={action} className="login-form" noValidate>
    <div className="login-field">
      <label htmlFor="email">Email address</label>
      <div className="login-input-wrap">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/></svg>
        <input id="email" name="email" type="email" autoComplete="username" placeholder="owner@jewelry.local" required aria-invalid={state.field==="email"||undefined}/>
      </div>
    </div>

    <div className="login-field">
      <div className="login-label-row">
        <label htmlFor="password">Password</label>
        <span>Secure staff access</span>
      </div>
      <div className="login-input-wrap">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
        <input id="password" name="password" type={showPassword?"text":"password"} autoComplete="current-password" placeholder="Enter your password" required minLength={10} aria-invalid={state.field==="password"||undefined}/>
        <button className="password-toggle" type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Hide password":"Show password"}>
          {showPassword?
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 10.7a2 2 0 0 0 2.7 2.7"/><path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 5 9 5a15 15 0 0 1-2.1 2.7M6.6 6.7C4.5 8.1 3 10 3 10s3.5 5 9 5c1 0 2-.2 2.8-.4"/></svg>:
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5Z"/><circle cx="12" cy="12" r="2.3"/></svg>}
        </button>
      </div>
    </div>

    {state.status==="error"&&<div className="login-error" role="alert" aria-live="polite">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/></svg>
      <div><b>Unable to sign in</b><span>{state.message}</span></div>
    </div>}

    <SubmitButton/>

    <div className="login-trust">
      <span><i/>{serviceState==="warming"?"Waking commerce API…":serviceState==="ready"?"Commerce API ready":"Commerce API retrying on sign-in"}</span>
      <span>8-hour secure access</span>
    </div>
  </form>;
}
