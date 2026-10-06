import Link from "next/link";
import {PageHeader} from "@/components/page-header";
import {getAdminProducts} from "@/lib/admin-api";

export default async function Products({searchParams}:{searchParams:Promise<{q?:string;status?:string;category?:string;vendor?:string;productType?:string;stock?:string;metafield?:string}>}){
  const params=await searchParams;
  const products=await getAdminProducts(params);
  const first=products[0];
  return <>
    <PageHeader eyebrow="CATALOG" title="Products" description="Canonical catalog shared by storefront, feeds, social channels and CRM.">
      <Link className="secondary-button" href="/metafields">Metafields</Link>
      <Link className="secondary-button" href="/products/new">+ New product</Link>
      {first&&<Link className="primary-button" href={"/products/"+first.id}>Open variant studio</Link>}
    </PageHeader>

    <form method="get" className="panel settings-panel" style={{marginBottom:14}}>
      <section className="settings-section">
        <h2>Catalog filters</h2>
        <div className="field-grid">
          <label className="field"><span>Search / SKU</span><input name="q" defaultValue={params.q||""} placeholder="title, handle, SKU, tag"/></label>
          <label className="field"><span>Status</span><select name="status" defaultValue={params.status||""}><option value="">Any</option><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label>
          <label className="field"><span>Category</span><input name="category" defaultValue={params.category||""}/></label>
          <label className="field"><span>Vendor</span><input name="vendor" defaultValue={params.vendor||""}/></label>
          <label className="field"><span>Product type</span><input name="productType" defaultValue={params.productType||""}/></label>
          <label className="field"><span>Stock</span><select name="stock" defaultValue={params.stock||""}><option value="">Any</option><option value="low">Low ≤3</option><option value="out">Out of stock</option></select></label>
          <label className="field"><span>Metafield</span><input name="metafield" defaultValue={params.metafield||""} placeholder="custom.stone_type:Diamond"/></label>
        </div>
        <div className="page-actions"><button className="primary-button">Apply filters</button><Link className="secondary-button" href="/products">Reset</Link></div>
      </section>
    </form>

    <div className="panel table-wrap">
      <table className="data-table">
        <thead><tr><th>PRODUCT</th><th>TYPE / VENDOR</th><th>SKU</th><th>VARIANTS</th><th>MEDIA</th><th>STOCK</th><th>STATUS</th><th className="right">PRICE</th></tr></thead>
        <tbody>
          {products.map(p=><tr key={p.id}>
            <td><Link href={"/products/"+p.id}><b>{p.name}</b><small>{p.category||"Jewelry"} · {p.material||"—"}</small></Link></td>
            <td>{p.productType||"—"}<small>{p.vendor||"—"}</small></td>
            <td>{p.sku}</td><td>{p.variantCount}</td><td>{p.mediaSetCount}</td><td>{p.inventory}</td>
            <td><span className={"status-pill "+(p.status==="active"?"success":"neutral")}>{p.status}</span></td>
            <td className="right">Rs. {p.price.toLocaleString("en-PK")}</td>
          </tr>)}
          {!products.length&&<tr><td colSpan={8}>No products match these filters.</td></tr>}
        </tbody>
      </table>
    </div>
  </>;
}