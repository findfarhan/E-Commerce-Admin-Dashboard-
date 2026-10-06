import {loginAction} from "./actions";
export default async function LoginPage({searchParams}:{searchParams:Promise<{error?:string}>}){
  const {error}=await searchParams;
  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24}}>
    <form action={loginAction} className="panel settings-panel" style={{width:"min(460px,100%)"}}>
      <section className="settings-section">
        <span>JEWELRY CONTROL</span><h1>Staff sign in</h1><p>Use your assigned admin account. Owner Basic Auth remains available as emergency access.</p>
        {error&&<p role="alert">Invalid email or password.</p>}
        <label className="field"><span>Email</span><input name="email" type="email" autoComplete="username" required/></label>
        <label className="field"><span>Password</span><input name="password" type="password" autoComplete="current-password" required minLength={10}/></label>
        <button className="primary-button" type="submit">Sign in</button>
      </section>
    </form>
  </main>;
}