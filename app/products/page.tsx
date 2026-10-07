import Link from "next/link";
import {PageHeader} from "@/components/page-header";
import {getAdminProducts} from "@/lib/admin-api";

export default async function Products({searchParams}:{searchParams:Promise<{q?:string;status?:string;category?:string;vendor?:string;productType?:string;stock?:string;metafield?:string}>}){
  const params=await searchParams;
  const [products,allProducts]=await Promise.all([getAdminProducts(params),getAdminProducts()]);
  const total=allProducts.length;
  const active=allProducts.filter(p=>p.status==="active").length;
  const drafts=allProducts.filter(p=>p.status==="draft").length;
  const lowStock=allProducts.filter(p=>p.inventory<=3).length;
  const inventory=allProducts.reduce((sum,p)=>sum+Number(p.inventory||0),0);

  const statusHref=(status?:string)=>{
    const q=new URLSearchParams();
    if(params.q) q.set("q",params.q);
    if(status) q.set("status",status);
    return "/products"+(q.size?"?"+q.toString():"");
  };

  return <div className="catalog-page products-workspace">
    <PageHeader eyebrow="CATALOG" title="Products" description="Manage products, variants, pricing, inventory and publishing from one catalog workspace.">
      <Link className="secondary-button" href="/metafields">Manage metafields</Link>
      <Link className="primary-button" href="/products/new">Add product</Link>
    </PageHeader>

    <section className="catalog-kpi-grid">
      <article><span>Total products</span><strong>{total}</strong><small>{inventory.toLocaleString("en-PK")} units across catalog</small></article>
      <article><span>Active</span><strong>{active}</strong><small>Published and available</small></article>
      <article><span>Drafts</span><strong>{drafts}</strong><small>Not yet published</small></article>
      <article><span>Low stock</span><strong>{lowStock}</strong><small>3 units or fewer</small></article>
    </section>

    <section className="catalog-panel">
      <div className="catalog-toolbar">
        <div className="catalog-tabs">
          <Link className={!params.status?"active":""} href={statusHref()}>All <span>{total}</span></Link>
          <Link className={params.status==="active"?"active":""} href={statusHref("active")}>Active <span>{active}</span></Link>
          <Link className={params.status==="draft"?"active":""} href={statusHref("draft")}>Draft <span>{drafts}</span></Link>
          <Link className={params.status==="archived"?"active":""} href={statusHref("archived")}>Archived</Link>
        </div>
        <form method="get" className="catalog-search-form">
          {params.status&&<input type="hidden" name="status" value={params.status}/>}
          <div className="catalog-search"><span>⌕</span><input name="q" defaultValue={params.q||""} placeholder="Search products, SKU or handle"/></div>
          <button className="secondary-button" type="submit">Search</button>
        </form>
      </div>

      <details className="catalog-advanced" open={Boolean(params.category||params.vendor||params.productType||params.stock||params.metafield)}>
        <summary>Advanced filters <span>Category, vendor, product type, stock and metafields</span></summary>
        <form method="get" className="catalog-filter-grid">
          {params.q&&<input type="hidden" name="q" value={params.q}/>}
          {params.status&&<input type="hidden" name="status" value={params.status}/>}
          <label><span>Category</span><input name="category" defaultValue={params.category||""} placeholder="Rings"/></label>
          <label><span>Vendor</span><input name="vendor" defaultValue={params.vendor||""} placeholder="Jewelry Store"/></label>
          <label><span>Product type</span><input name="productType" defaultValue={params.productType||""} placeholder="Ring"/></label>
          <label><span>Stock</span><select name="stock" defaultValue={params.stock||""}><option value="">Any stock</option><option value="low">Low stock ≤3</option><option value="out">Out of stock</option></select></label>
          <label className="wide"><span>Metafield condition</span><input name="metafield" defaultValue={params.metafield||""} placeholder="jewelry.stone_type:Diamond"/></label>
          <div className="catalog-filter-actions"><Link className="secondary-button" href="/products">Clear all</Link><button className="primary-button">Apply filters</button></div>
        </form>
      </details>

      <div className="catalog-table-wrap">
        <table className="catalog-table">
          <thead><tr><th>Product</th><th>Organization</th><th>Inventory</th><th>Variants</th><th>Status</th><th className="right">Price</th><th></th></tr></thead>
          <tbody>
            {products.map(p=><tr key={p.id}>
              <td>
                <Link className="catalog-product-cell" href={"/products/"+p.id}>
                  <span className="catalog-thumb">◇</span>
                  <span><b>{p.name}</b><small>{p.sku} · /{p.handle}</small></span>
                </Link>
              </td>
              <td><div className="catalog-stack"><b>{p.productType||p.category||"Jewelry"}</b><small>{p.vendor||"No vendor"} · {p.material||"Material not set"}</small></div></td>
              <td><div className={"inventory-number "+(p.inventory<=3?"warning":"")}><b>{p.inventory}</b><small>{p.inventory<=0?"Out of stock":p.inventory<=3?"Low stock":"In stock"}</small></div></td>
              <td><div className="catalog-stack"><b>{p.variantCount}</b><small>{p.mediaSetCount} media sets</small></div></td>
              <td><span className={"status-pill "+(p.status==="active"?"success":p.status==="draft"?"neutral":"warning")}>{p.status}</span></td>
              <td className="right"><b>Rs. {p.price.toLocaleString("en-PK")}</b></td>
              <td className="right"><Link className="row-action" href={"/products/"+p.id}>Open →</Link></td>
            </tr>)}
            {!products.length&&<tr><td colSpan={7}><div className="catalog-empty"><b>No products found</b><span>Try changing the filters or add a new product.</span><Link className="primary-button" href="/products/new">Add product</Link></div></td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </div>;
}
 