"use client";
import {useActionState} from "react";
import {loginAction} from "./actions";

export function LoginForm(){
  const [state,action,pending]=useActionState(loginAction,{});
  return <form action={action} className="login-card">
    <div className="login-mark">JC</div>
    <div>
      <span className="login-eyebrow">JEWELRY CONTROL</span>
      <h1>Secure admin access</h1>
      <p>Sign in with your owner or staff account.</p>
    </div>
    <label className="field"><span>Username or email</span><input name="username" autoComplete="username" required autoFocus/></label>
    <label className="field"><span>Password</span><input name="password" type="password" autoComplete="current-password" required/></label>
    {state?.error&&<div className="login-error">{state.error}</div>}
    <button className="primary-button" disabled={pending} type="submit">{pending?"Signing in…":"Sign in"}</button>
    <small>Sessions expire after 8 hours. Access is role-controlled and audited.</small>
  </form>;
}
