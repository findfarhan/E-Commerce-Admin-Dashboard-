import Link from "next/link";
import {PageHeader} from "@/components/page-header";
import {getAdminCollections} from "@/lib/admin-api";

export default async function CollectionsPage(){
  const collections=await getAdminCollections();
  const active=collections.filter((c:any)=>c.status==="active").length;
  const draft=collections.filter((c:any)=>c.status!=="active").length;
  const products=collections.reduce((sum:number,c:any)=>sum+Number(c.product_count||0),0);

  return <div className="catalog-page">
    <PageHeader eyebrow="MERCHANDISING" title="Collections" description="Organize product discovery, campaign groups and storefront merchandising.">
      <Link className="primary-button" href="/collections/new">Create collection</Link>
    </PageHeader>

    <section className="catalog-kpi-grid three">
      <article><span>Total collections</span><strong>{collections.length}</strong><small>Manual and smart groups</small></article>
      <article><span>Active</span><strong>{active}</strong><small>Published on storefront</small></article>
      <article><span>Products assigned</span><strong>{products}</strong><small>{draft} draft collections</small></article>
    </section>

    <section className="catalog-panel">
      <div className="catalog-section-head">
        <div><span>COLLECTION LIBRARY</span><h2>Merchandising groups</h2><p>Control how shoppers discover and browse related products.</p></div>
        <Link className="secondary-button" href="/collections/new">New collection</Link>
      </div>

      <div className="collection-grid-pro">
        {collections.map((collection:any)=><Link className="collection-card-pro" href={"/collections/"+collection.id} key={collection.id}>
          <div className="collection-card-visual">
            <span className="collection-symbol">◇</span>
            <span className={"status-pill "+(collection.status==="active"?"success":"neutral")}>{collection.status||"draft"}</span>
          </div>
          <div className="collection-card-body">
            <div className="collection-card-title"><h3>{collection.title}</h3><span>→</span></div>
            <p>{collection.subtitle||collection.description||"Curated storefront collection"}</p>
            <div className="collection-card-meta">
              <div><span>Products</span><b>{Number(collection.product_count||0)}</b></div>
              <div><span>Handle</span><b>/{collection.handle}</b></div>
              <div><span>Position</span><b>{collection.position??"—"}</b></div>
            </div>
          </div>
        </Link>)}
        {!collections.length&&<div className="catalog-empty card-empty"><b>No collections yet</b><span>Create your first collection to organize storefront discovery.</span><Link className="primary-button" href="/collections/new">Create collection</Link></div>}
      </div>
    </section>
  </div>;
}
