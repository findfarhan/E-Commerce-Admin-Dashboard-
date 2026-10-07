import LoginForm from "./login-form";

export default function LoginPage(){
  return <main className="login-page">
    <section className="login-story" aria-hidden="true">
      <div className="login-story-glow"/>
      <div className="login-brand">
        <div className="login-brand-mark">JC</div>
        <div><strong>JEWELRY CONTROL</strong><span>Commerce operating system</span></div>
      </div>

      <div className="login-story-copy">
        <span className="login-eyebrow">PRIVATE ADMIN CONSOLE</span>
        <h1>Operate your jewelry business from one secure workspace.</h1>
        <p>Products, inventory, customers, orders, merchandising and commerce operations — connected to one source of truth.</p>
        <div className="login-capabilities">
          <div><i>01</i><span><b>Commerce control</b><small>Orders, pricing, returns and customer operations</small></span></div>
          <div><i>02</i><span><b>Inventory intelligence</b><small>Variants, locations, purchasing and stock movement</small></span></div>
          <div><i>03</i><span><b>Role-based security</b><small>Protected staff access with audited permissions</small></span></div>
        </div>
      </div>

      <div className="login-system-state">
        <span><i/>Systems operational</span>
        <small>Admin API · Supabase · Secure session</small>
      </div>
    </section>

    <section className="login-access">
      <div className="login-access-inner">
        <div className="login-mobile-brand">
          <div className="login-brand-mark">JC</div>
          <div><strong>JEWELRY CONTROL</strong><span>Commerce operating system</span></div>
        </div>

        <div className="login-heading">
          <span>WELCOME BACK</span>
          <h2>Sign in to your workspace</h2>
          <p>Enter your staff credentials to continue to Jewelry Control.</p>
        </div>

        <LoginForm/>

        <div className="login-security-note">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Z"/><path d="m9.5 12 1.6 1.6 3.6-3.8"/></svg>
          <p><b>Protected staff area</b><span>Access is logged and permissions are enforced by the backend.</span></p>
        </div>

        <footer className="login-footer">Jewelry Control · Enterprise Commerce Admin</footer>
      </div>
    </section>
  </main>;
}
