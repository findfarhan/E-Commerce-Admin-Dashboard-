import Link from "next/link";
import {PageHeader} from "@/components/page-header";
import {adminRequest} from "@/lib/admin-api";
import {createRedirectAction,deleteRedirectAction} from "./actions";

export default async function RedirectsPage(){
  const response=await adminRequest<{items:any[]}>("/v1/admin/redirects",10);
  const redirects=response?.items||[];
  return <>
    <PageHeader eyebrow="SEO / URL CONTROL" title="Redirect registry" description="Preserve authority when product, collection or content URLs change.">
      <Link className="secondary-button" href="/seo">Back to SEO</Link>
    </PageHeader>

    <section className="dashboard-grid">
      <form action={createRedirectAction} className="panel settings-panel">
        <section className="settings-section">
          <h2>Add redirect</h2>
          <p>Use internal paths only. Permanent URL changes should normally use 301.</p>
          <div className="field-grid">
            <label className="field"><span>Old path</span><input name="sourcePath" required placeholder="/old-ring"/></label>
            <label className="field"><span>New path</span><input name="targetPath" required placeholder="/product/celestia-ring"/></label>
            <label className="field"><span>Status</span><select name="statusCode" defaultValue="301"><option value="301">301 Permanent</option><option value="302">302 Temporary</option><option value="307">307 Temporary</option><option value="308">308 Permanent</option></select></label>
          </div>
          <button className="primary-button" type="submit">Save redirect</button>
        </section>
      </form>

      <article className="panel">
        <div className="panel-head"><div><span>LIVE RULES</span><h2>{redirects.length} redirects</h2></div></div>
        <div className="seo-check-list">
          {redirects.map((item:any)=>{
            const remove=deleteRedirectAction.bind(null,item.id);
            return <div key={item.id} style={{gridTemplateColumns:"1fr auto"}}>
              <span><b>{item.source_path}</b><small style={{display:"block"}}>→ {item.target_path} · {item.status_code}</small></span>
              <form action={remove}><button className="secondary-button" type="submit">Delete</button></form>
            </div>;
          })}
          {!redirects.length&&<div><span>No redirects configured.</span><em>Clean registry</em></div>}
        </div>
      </article>
    </section>
  </>;
}
