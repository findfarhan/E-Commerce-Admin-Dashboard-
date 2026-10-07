import Link from "next/link";
import {setupOwnerAction} from "./actions";

export default async function SetupPage({searchParams}:{searchParams:Promise<{error?:string}>}){
  const {error}=await searchParams;
  return <main className="login-shell">
    <section className="login-card">
      <div className="admin-brand"><span>JC</span><div><b>JEWELRY CONTROL</b><small>FIRST OWNER SETUP</small></div></div>
      <div>
        <span className="eyebrow">SECURE BOOTSTRAP</span>
        <h1>Create the owner account</h1>
        <p>This page works only before the first staff account exists. Use a unique 12+ character password.</p>
      </div>
      {error&&<div className="auth-error">{error==="password_mismatch"?"Passwords do not match.":error==="configuration"?"Admin deployment is missing its secure API key.":"Setup could not be completed."}</div>}
      <form action={setupOwnerAction} className="settings-section">
        <label className="field"><span>Name</span><input name="name" required autoComplete="name" placeholder="Store Owner"/></label>
        <label className="field"><span>Email</span><input name="email" type="email" required autoComplete="email" placeholder="owner@example.com"/></label>
        <label className="field"><span>Password</span><input name="password" type="password" minLength={12} required autoComplete="new-password"/></label>
        <label className="field"><span>Confirm password</span><input name="confirmPassword" type="password" minLength={12} required autoComplete="new-password"/></label>
        <button className="primary-button" type="submit">Create owner & sign in</button>
      </form>
      <small>Already configured? <Link href="/login">Sign in</Link></small>
    </section>
  </main>;
}
