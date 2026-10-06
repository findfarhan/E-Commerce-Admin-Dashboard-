import Link from "next/link";
import {notFound} from "next/navigation";
import {PageHeader} from "@/components/page-header";
import {getAdminCollectionDetail,getAdminProducts,getAdminSeo} from "@/lib/admin-api";
import {saveCollectionSeoAction,updateCollectionAction} from "../actions";

export default async function CollectionDetailPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const [detail,products,seo]=await Promise.all([getAdminCollectionDetail(id),getAdminProducts(),getAdminSeo("collection",id)]);
  if(!detail) notFound();
  const collection=detail.collection;
  const selected=new Set((detail.products||[]).map((p:any)=>p.id));
  const positions=new Map<string,number>((detail.products||[]).map((p:any):[string,number]=>[String(p.id),Number(p.position||0)]));
  const action=updateCollectionAction.bind(null,id);
  const seoAction=saveCollectionSeoAction.bind(null,id,collection.handle);

  return <>
    <PageHeader eyebrow="MERCHANDISING / COLLECTION" title={collection.title} description="Edit content, storefront state and exact product ordering.">
      <Link className="secondary-button" href="/collections">Back</Link>
    </PageHeader>
    <form action={action} className="panel settings-panel">
      <section className="settings-section">
        <h2>Collection content</h2>
        <div className="field-grid">
          <label className="field"><span>Title</span><input name="title" required defaultValue={collection.title}/></label>
          <label className="field"><span>Handle</span><input name="handle" required defaultValue={collection.handle}/></label>
          <label className="field"><span>Subtitle</span><input name="subtitle" defaultValue={collection.subtitle||""}/></label>
          <label className="field"><span>Status</span><select name="status" defaultValue={collection.status}><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label>
          <label className="field"><span>Position</span><input name="position" type="number" min="0" defaultValue={collection.position||0}/></label>
          <label className="field"><span>Collection type</span><select name="collectionType" defaultValue={collection.collection_type||"manual"}><option value="manual">Manual / curated</option><option value="smart">Smart / rule-based</option></select></label>
          <label className="field"><span>Rule matching</span><select name="matchType" defaultValue={collection.match_type||"all"}><option value="all">Match all rules</option><option value="any">Match any rule</option></select></label>
          <label className="field"><span>Publish at</span><input name="publishAt" type="datetime-local" defaultValue={collection.publish_at?new Date(collection.publish_at).toISOString().slice(0,16):""}/></label>
          <label className="field"><span>Unpublish at</span><input name="unpublishAt" type="datetime-local" defaultValue={collection.unpublish_at?new Date(collection.unpublish_at).toISOString().slice(0,16):""}/></label>
          <label className="field"><span>Hero image URL</span><input name="imageUrl" defaultValue={collection.image_url||""}/></label>
          <label className="field" style={{gridColumn:"1 / -1"}}><span>Description</span><textarea name="description" rows={5} defaultValue={collection.description||""}/></label>
        </div>
        <h3>Smart collection rules</h3>
        <p>Rules are used only for Smart collections. Metafields use <code>metafield:custom.key</code>.</p>
        <div className="seo-check-list">
          {Array.from({length:5}).map((_,i)=>{const rule=(collection.rules||[])[i]||{};return <div className="field-grid" key={i}><label className="field"><span>Field</span><input name={"ruleField_"+i} defaultValue={rule.field||""} placeholder="category"/></label><label className="field"><span>Operator</span><select name={"ruleOperator_"+i} defaultValue={rule.operator||"equals"}><option value="equals">Equals</option><option value="not_equals">Not equals</option><option value="contains">Contains</option></select></label><label className="field"><span>Value</span><input name={"ruleValue_"+i} defaultValue={rule.value||""}/></label></div>})}
        </div>
      </section>

      <section className="settings-section">
        <h2>{collection.collection_type==="smart"?"Current smart matches":"Products"}</h2>
        <p>{collection.collection_type==="smart"?"These products currently match the rules. Switch to Manual to curate exact membership.":"Select products and control exact storefront order with position."}</p>
        <div className="seo-check-list">
          {products.map((product,index)=><label key={product.id} style={{display:"grid",gridTemplateColumns:"auto 1fr 90px auto",gap:12,alignItems:"center"}}>
            <input type="checkbox" name="productIds" value={product.id} defaultChecked={selected.has(product.id)}/>
            <span><b>{product.name}</b><small style={{display:"block"}}>{product.category||"Jewelry"} · {product.sku}</small></span>
            <input name={"position__"+product.id} type="number" min="0" defaultValue={positions.get(product.id)??index} aria-label={"Position for "+product.name}/>
            <em>{product.status}</em>
          </label>)}
        </div>
      </section>

      <div className="page-actions"><button className="primary-button" type="submit">Save collection</button></div>
    </form>

    <form action={seoAction} className="panel settings-panel" style={{marginTop:14}}>
      <section className="settings-section">
        <h2>Collection SEO</h2>
        <p>Curated collection pages stay indexable; operational filters remain outside the indexed URL model.</p>
        <div className="field-grid">
          <label className="field"><span>SEO title</span><input name="seoTitle" defaultValue={seo?.title||collection.title+" Jewelry | Jewelry Store"}/></label>
          <label className="field"><span>Canonical path</span><input name="canonicalPath" defaultValue={seo?.canonical_path||("/collections/"+collection.handle)}/></label>
          <label className="field" style={{gridColumn:"1 / -1"}}><span>Meta description</span><textarea name="metaDescription" rows={4} defaultValue={seo?.meta_description||collection.description||collection.subtitle||""}/></label>
          <label className="field"><span>Index in search</span><input name="index" type="checkbox" defaultChecked={seo?.robots_index!==false}/></label>
        </div>
        <button className="primary-button" type="submit">Save collection SEO</button>
      </section>
    </form>
  </>;
}
