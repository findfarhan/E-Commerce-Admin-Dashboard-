import Link from "next/link";
import {PageHeader} from "@/components/page-header";
import {StatusPill} from "@/components/status-pill";
import {adminRequest} from "@/lib/admin-api";
import {completeReturnAction} from "@/app/enterprise-actions";

export default async function ReturnsPage(){
 const [data,locations]=await Promise.all([adminRequest<any>("/v1/admin/returns",0),adminRequest<any>("/v1/admin/locations",0)]);
 const items=data?.items||[];
 return <><PageHeader eyebrow="AFTER SALES" title="Returns & exchanges" description="Partial returns, variant exchanges, condition/restock handling and refund ledger integration."><Link className="primary-button" href="/returns/new">+ New return</Link></PageHeader>
 <div className="panel table-wrap"><table className="data-table"><thead><tr><th>RETURN</th><th>ORDER</th><th>CUSTOMER</th><th>STATUS</th><th>REASON</th><th>REFUND</th><th>ACTION</th></tr></thead><tbody>{items.map((r:any)=>{const action=completeReturnAction.bind(null,r.id);return <tr key={r.id}><td><b>{r.return_number}</b><small>{new Date(r.created_at).toLocaleString("en-PK")}</small></td><td>{r.order_number}</td><td>{r.customer_name||"Guest"}</td><td><StatusPill tone={r.status==="completed"?"success":r.status==="requested"?"warning":"neutral"}>{r.status}</StatusPill></td><td>{r.reason||"—"}</td><td>Rs. {Number(r.refund_amount||0).toLocaleString("en-PK")}</td><td>{r.status!=="completed"&&<form action={action} style={{display:"flex",gap:6,alignItems:"center"}}><select name="locationId" required defaultValue=""><option value="" disabled>Restock at…</option>{(locations?.items||[]).map((l:any)=><option key={l.id} value={l.id}>{l.name}</option>)}</select><input name="refundAmount" type="hidden" value={Number(r.refund_amount||0)}/><button className="secondary-button" type="submit">Complete</button></form>}</td></tr>})}{!items.length&&<tr><td colSpan={7}>No returns yet.</td></tr>}</tbody></table></div></>;
}
