import {PageHeader} from "@/components/page-header";
import {getAdminCollections,getAdminProducts,adminRequest} from "@/lib/admin-api";
import {createDiscountAction} from "@/app/commerce/actions";

export default async function Discounts(){
  const [discounts,products,collections]=await Promise.all([
    adminRequest<any>("/v1/admin/commerce/discounts",0),
    getAdminProducts(),
    getAdminCollections(),
  ]);
  return <>
    <PageHeader eyebrow="PRICING" title="Discounts" description="Code-based and automatic discounts with product/collection scopes, limits, windows and minimum-order controls."/>
    <section className="dashboard-grid">
      <form action={createDiscountAction} className="panel settings-panel">
        <section className="settings-section">
          <h2>Create discount</h2>
          <div className="field-grid">
            <label className="field"><span>Code</span><input name="code" required placeholder="WELCOME10"/></label>
            <label className="field"><span>Name</span><input name="name" placeholder="Welcome offer"/></label>
            <label className="field"><span>Kind</span><select name="kind"><option value="percentage">Percentage</option><option value="fixed">Fixed amount</option><option value="free_shipping">Free shipping</option></select></label>
            <label className="field"><span>Value</span><input name="value" type="number" min="0" step="0.01" required/></label>
            <label className="field"><span>Applies to</span><select name="appliesTo"><option value="order">Whole order</option><option value="product">Selected products</option><option value="collection">Selected collections</option></select></label>
            <label className="field"><span>Minimum order</span><input name="minimumOrder" type="number" min="0"/></label>
            <label className="field"><span>Usage limit</span><input name="usageLimit" type="number" min="1"/></label>
            <label className="field"><span>Starts</span><input name="startsAt" type="datetime-local"/></label>
            <label className="field"><span>Ends</span><input name="endsAt" type="datetime-local"/></label>
            <label className="field"><span>Automatic</span><input name="automatic" type="checkbox"/></label>
          </div>
          <div className="dashboard-grid lower">
            <div>
              <h3>Product scope</h3>
              <div className="seo-check-list" style={{maxHeight:260,overflow:"auto"}}>
                {products.map(p=><label key={p.id} style={{display:"flex",gap:10,alignItems:"center"}}><input type="checkbox" name="productIds" value={p.id}/><span><b>{p.name}</b><small style={{display:"block"}}>{p.sku} · {p.status}</small></span></label>)}
              </div>
            </div>
            <div>
              <h3>Collection scope</h3>
              <div className="seo-check-list" style={{maxHeight:260,overflow:"auto"}}>
                {(collections||[]).map((x:any)=><label key={x.id} style={{display:"flex",gap:10,alignItems:"center"}}><input type="checkbox" name="collectionIds" value={x.id}/><span><b>{x.title}</b><small style={{display:"block"}}>{x.product_count} products</small></span></label>)}
              </div>
            </div>
          </div>
          <button className="primary-button">Create discount</button>
        </section>
      </form>
      <article className="panel">
        <div className="panel-head"><div><span>PRICING RULES</span><h2>Active & scheduled</h2></div></div>
        <div className="activity-list">
          {(discounts?.items||[]).map((x:any)=><div className="activity-item" key={x.id}><span>•</span><div><b>{x.code}</b><p>{x.kind} · {x.value} · {x.applies_to} · used {x.usage_count}{x.usage_limit?"/"+x.usage_limit:""}</p><small>{x.automatic?"Automatic · ":""}{x.starts_at?"Starts "+new Date(x.starts_at).toLocaleString("en-PK"):""}{x.ends_at?" · Ends "+new Date(x.ends_at).toLocaleString("en-PK"):""}</small></div><em>{x.active?"ACTIVE":"OFF"}</em></div>)}
        </div>
      </article>
    </section>
  </>;
}
