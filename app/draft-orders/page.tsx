import Link from "next/link";
import {PageHeader} from "@/components/page-header";
import {StatusPill} from "@/components/status-pill";
import {adminRequest} from "@/lib/admin-api";

export default async function DraftOrdersPage(){
  const data=await adminRequest<any>("/v1/admin/draft-orders",0);
  const items=data?.items||[];
  return <>
    <PageHeader eyebrow="SALES / QUOTES" title="Draft orders & quotes" description="Negotiated jewelry quotes remain editable until accepted and converted into an inventory-deducting order."><Link className="primary-button" href="/draft-orders/new">+ New quote</Link></PageHeader>
    <div className="panel table-wrap"><table className="data-table"><thead><tr><th>QUOTE</th><th>CUSTOMER</th><th>STATUS</th><th>ITEMS</th><th>EXPIRES</th><th className="right">TOTAL</th></tr></thead><tbody>
      {items.map((item:any)=><tr key={item.id}><td><Link href={"/draft-orders/"+item.id}><b>{item.quote_number}</b></Link><small>{new Date(item.created_at).toLocaleString("en-PK")}</small></td><td>{item.customer_name||"Unassigned"}<small>{item.customer_email||"—"}</small></td><td><StatusPill tone={item.status==="converted"?"success":item.status==="sent"?"info":"neutral"}>{item.status}</StatusPill></td><td>{item.item_count}</td><td>{item.expires_at?new Date(item.expires_at).toLocaleDateString("en-PK"):"—"}</td><td className="right">Rs. {Number(item.total).toLocaleString("en-PK")}</td></tr>)}
      {!items.length&&<tr><td colSpan={6}>No draft quotes yet.</td></tr>}
    </tbody></table></div>
  </>;
}
