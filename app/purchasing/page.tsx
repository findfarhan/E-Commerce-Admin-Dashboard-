import Link from "next/link";
import {PageHeader} from "@/components/page-header";
import {PurchaseOrderBuilder} from "@/components/purchase-order-builder";
import {StatusPill} from "@/components/status-pill";
import {adminRequest} from "@/lib/admin-api";
import {createPurchaseOrderAction,createSupplierAction} from "@/app/enterprise-actions";

export default async function PurchasingPage(){
  const [pos,suppliers,catalog,locations]=await Promise.all([adminRequest<any>("/v1/admin/purchase-orders",0),adminRequest<any>("/v1/admin/suppliers",0),adminRequest<any>("/v1/admin/order-catalog",0),adminRequest<any>("/v1/admin/locations",0)]);
  return <>
    <PageHeader eyebrow="INVENTORY / PROCUREMENT" title="Purchasing" description="Suppliers, purchase orders, incoming stock, receiving and weighted variant cost."/>
    <section className="dashboard-grid"><PurchaseOrderBuilder action={createPurchaseOrderAction} catalog={catalog?.items||[]} suppliers={suppliers?.items||[]} locations={locations?.items||[]}/>
    <article className="panel enterprise-card"><h3>Add supplier</h3><form action={createSupplierAction} className="field-grid" style={{marginTop:16}}><label className="field"><span>Name</span><input name="name" required/></label><label className="field"><span>Email</span><input name="email" type="email"/></label><label className="field"><span>Phone</span><input name="phone"/></label><label className="field" style={{gridColumn:"1 / -1"}}><span>Notes</span><textarea name="notes" rows={4}/></label><button className="primary-button" type="submit">Add supplier</button></form><div style={{marginTop:20}}>{(suppliers?.items||[]).map((s:any)=><div className="metric-row" key={s.id}><span>{s.name}</span><b>{s.email||s.phone||"Active"}</b></div>)}</div></article></section>
    <div className="panel table-wrap"><table className="data-table"><thead><tr><th>PO</th><th>SUPPLIER</th><th>LOCATION</th><th>STATUS</th><th>ITEMS</th><th>EXPECTED</th><th className="right">VALUE</th></tr></thead><tbody>{(pos?.items||[]).map((p:any)=><tr key={p.id}><td><Link href={"/purchasing/"+p.id}><b>{p.po_number}</b></Link></td><td>{p.supplier_name||"—"}</td><td>{p.location_name||"—"}</td><td><StatusPill tone={p.status==="received"?"success":p.status==="ordered"||p.status==="partially_received"?"info":"neutral"}>{p.status}</StatusPill></td><td>{p.item_count}</td><td>{p.expected_at?new Date(p.expected_at).toLocaleDateString("en-PK"):"—"}</td><td className="right">Rs. {Number(p.subtotal).toLocaleString("en-PK")}</td></tr>)}</tbody></table></div>
  </>;
}
