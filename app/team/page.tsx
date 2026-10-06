import {PageHeader} from "@/components/page-header";

export default function Team(){
  return <>
    <PageHeader eyebrow="ACCESS / CURRENT MODE" title="Team" description="The current launch uses a single protected owner account. Multi-user RBAC is intentionally not pretended to exist."/>
    <section className="team-grid">
      <article className="team-card"><span className="team-avatar">FA</span><h3>Owner</h3><span>Full Jewelry Control access</span><div className="team-card-footer"><span>Active</span><span>Basic-auth protected</span></div></article>
      <article className="panel empty-panel"><div><h2>Multi-user roles are not enabled yet</h2><p>Catalog, CRM, growth and fulfillment roles can be added when multiple staff accounts are actually needed. Current production access remains single-owner.</p></div></article>
    </section>
  </>;
}
