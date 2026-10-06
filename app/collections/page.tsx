import Link from "next/link";
import {PageHeader} from "@/components/page-header";
import {getAdminCollections} from "@/lib/admin-api";

export default async function CollectionsPage(){
  const collections=await getAdminCollections();
  return <>
    <PageHeader eyebrow="MERCHANDISING" title="Collections" description="Curated product groups, storefront discovery and collection-level SEO.">
      <Link className="primary-button" href="/collections/new">+ New collection</Link>
    </PageHeader>
    <section className="channel-hub-grid">
      {collections.map((collection:any)=><Link className="channel-publish-card" href={"/collections/"+collection.id} key={collection.id}>
        <div className="channel-publish-head">
          <div><span>{collection.status?.toUpperCase()}</span><b>{collection.title}</b></div>
          <em className={"publish-state "+(collection.status==="active"?"synced":"draft")}>{collection.product_count} products</em>
        </div>
        <p>{collection.subtitle||collection.description||"Curated storefront collection"}</p>
        <div className="channel-publish-meta"><small>/{collection.handle}</small><small>Position {collection.position}</small></div>
      </Link>)}
      {!collections.length&&<article className="panel empty-panel"><div><h2>No collections yet</h2><p>Create a curated collection to control storefront discovery.</p></div></article>}
    </section>
  </>;
}
