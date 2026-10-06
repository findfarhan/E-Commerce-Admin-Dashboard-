import Link from "next/link";
import {PageHeader} from "@/components/page-header";
import {getAdminProducts} from "@/lib/admin-api";

export default async function Products(){
  const products=await getAdminProducts();
  const first=products[0];

  return <>
    <PageHeader eyebrow="CATALOG" title="Products" description="Canonical catalog shared by storefront, feeds, social channels and CRM.">
      <Link className="secondary-button" href="/products/new">+ New product</Link>\n      {first&&<Link className="primary-button" href={"/products/"+first.id}>Open variant studio</Link>}
    </PageHeader>

    <div className="panel table-wrap">
      <table className="data-table">
        <thead><tr><th>PRODUCT</th><th>SKU</th><th>VARIANTS</th><th>MEDIA SETS</th><th>STOCK</th><th>STATUS</th><th className="right">PRICE</th></tr></thead>
        <tbody>
          {products.map(p=><tr key={p.id}>
            <td><Link href={"/products/"+p.id}><b>{p.name}</b><small>{p.status}</small></Link></td>
            <td>{p.sku}</td>
            <td>{p.variantCount}</td>
            <td>{p.mediaSetCount}</td>
            <td>{p.inventory}</td>
            <td><span className={"status-pill "+(p.status==="active"?"success":"neutral")}>{p.status}</span></td>
            <td className="right">Rs. {p.price.toLocaleString("en-PK")}</td>
          </tr>)}
          {!products.length&&<tr><td colSpan={7}>No products yet.</td></tr>}
        </tbody>
      </table>
    </div>
  </>;
}
