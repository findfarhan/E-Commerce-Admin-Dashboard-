import Link from "next/link";
import {PageHeader} from "@/components/page-header";
import {BundleEditor} from "@/components/bundle-editor";
import {adminRequest} from "@/lib/admin-api";
import "./bundles.css";
export default async function BundlesPage(){
  const [bundleResult,variantResult]=await Promise.all([
    adminRequest<{items:any[]}>("/v1/admin/bundles"),
    adminRequest<{items:any[]}>("/v1/admin/bundles/variants"),
  ]);
  if(!bundleResult||!variantResult){
    return <section className="panel" style={{padding:32}}>
      <h2>Bundle management is not ready</h2>
      <p>Verify that database migration 024 is installed and the bundle API is deployed. No bundle data is being overwritten.</p>
      <Link href="/products" className="secondary-button">Back to products</Link>
    </section>;
  }
  const active=bundleResult.items.filter(b=>b.status==="active").length;
  const valid=bundleResult.items.filter(b=>b.eligible).length;
  return <main className="bundle-workspace">
    <PageHeader eyebrow="PRODUCT MERCHANDISING" title="Jewelry Bundles"
      description="Create shoppable sets of exact jewelry variants with transparent savings, stock checks and independent product fulfillment.">
      <Link href="/products" className="secondary-button">Product catalog ↗</Link>
    </PageHeader>
    <section className="bundle-admin-kpis" aria-label="Bundle overview">
      <article><span>Total curated sets</span><strong>{bundleResult.items.length}</strong></article>
      <article><span>Published sets</span><strong>{active}</strong></article>
      <article><span>Available for sale</span><strong>{valid}</strong></article>
      <article><span>Bundle stock</span><strong>SKU-led</strong><small>Never double-counted</small></article>
    </section>
    <BundleEditor bundles={bundleResult.items} variants={variantResult.items}/>
  </main>;
}
