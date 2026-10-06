import {PageHeader} from "@/components/page-header";
import {StatusPill} from "@/components/status-pill";
import {adminRequest} from "@/lib/admin-api";

export default async function Automations(){
  const data=await adminRequest<any>("/v1/admin/operations/automations",0);
  if(!data) throw new Error("Automation status unavailable.");
  return <>
    <PageHeader eyebrow="OPERATIONS / LIVE" title="Automations" description="Internal automations that are actually running are separated from provider-dependent workflows."/>
    <section className="stats-grid">
      <article className="stat-card"><span>QUEUED JOBS</span><strong>{Number(data.jobs?.queued||0)}</strong><small>Postgres job queue</small></article>
      <article className="stat-card"><span>FAILED JOBS</span><strong>{Number(data.jobs?.failed||0)}</strong><small>Requires attention</small></article>
      <article className="stat-card"><span>OPEN CHECKOUTS</span><strong>{data.openCheckouts}</strong><small>Expiry cleanup active</small></article>
      <article className="stat-card"><span>LOW STOCK</span><strong>{data.lowStockVariants}</strong><small>Dashboard watch threshold</small></article>
    </section>
    <section className="automation-grid">
      {(data.rules||[]).map((rule:any)=><article className="automation-card" key={rule.key}>
        <div className="automation-card-top"><span className="automation-card-icon">⚡</span><StatusPill tone={rule.status==="active"?"success":"neutral"}>{rule.status}</StatusPill></div>
        <h3>{rule.name}</h3>
        <p><b>When:</b> {rule.trigger}<br/><b>Then:</b> {rule.action}</p>
        <div className="automation-meta"><span>{rule.scope}</span></div>
      </article>)}
    </section>
  </>;
}
