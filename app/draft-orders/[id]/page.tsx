import {notFound} from "next/navigation";
import {PageHeader} from "@/components/page-header";
import {StatusPill} from "@/components/status-pill";
import {adminRequest} from "@/lib/admin-api";
import {convertDraftOrderAction,sendDraftOrderAction} from "@/app/enterprise-actions";

export default async function DraftDetail({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const [data,locations]=await Promise.all([adminRequest<any>("/v1/admin/draft-orders/"+id,0),adminRequest<any>("/v1/admin/locations",0)]);
  if(!data) notFound();
  const draft=data.draft,items=data.items||[];
  const send=sendDraftOrderAction.bind(null,id),convert=convertDraftOrderAction.bind(null,id);
  return <>
    <PageHeader eyebrow="QUOTE / DETAIL" title={draft.quote_number} description={(draft.customer_name||"Unassigned customer")+" · "+draft.currency}><StatusPill tone={draft.status==="converted"?"success":draft.status==="sent"?"info":"neutral"}>{draft.status}</StatusPill></PageHeader>
    <section className="stats-grid"><article className="stat-card"><span>SUBTOTAL</span><strong>Rs. {Number(draft.subtotal).toLocaleString("en-PK")}</strong></article><article className="stat-card"><span>DISCOUNT</span><strong>Rs. {Number(draft.discount_amount).toLocaleString("en-PK")}</strong></article><article className="stat-card"><span>SHIPPING + TAX</span><strong>Rs. {(Number(draft.shipping_amount)+Number(draft.tax_amount)).toLocaleString("en-PK")}</strong></article><article className="stat-card"><span>TOTAL</span><strong>Rs. {Number(draft.total).toLocaleString("en-PK")}</strong></article></section>
    <div className="dashboard-grid"><article className="panel"><div className="panel-head"><div><span>QUOTE LINES</span><h2>Pricing snapshot</h2></div></div><div className="table-wrap"><table className="data-table"><thead><tr><th>ITEM</th><th>SKU</th><th>QTY</th><th>PRICE</th><th className="right">TOTAL</th></tr></thead><tbody>{items.map((item:any)=><tr key={item.id}><td><b>{item.title}</b><small>{Object.entries(item.selected_options||{}).map(([k,v])=>k+": "+v).join(" · ")}</small></td><td>{item.sku}</td><td>{item.quantity}</td><td>Rs. {Number(item.unit_price).toLocaleString("en-PK")}{item.price_overridden&&<small>Overridden</small>}</td><td className="right">Rs. {Number(item.line_total).toLocaleString("en-PK")}</td></tr>)}</tbody></table></div></article>
    <article className="panel enterprise-card"><h3>Quote actions</h3><p>Sending queues a transactional quote email. Conversion creates the order atomically and deducts stock.</p>
      {draft.status!=="converted"&&<><form action={send} className="field-grid" style={{marginTop:16}}><label className="field" style={{gridColumn:"1 / -1"}}><span>Email subject</span><input name="subject" defaultValue={"Your jewelry quote "+draft.quote_number}/></label><button className="secondary-button" type="submit">Queue quote email</button></form>
      <form action={convert} className="field-grid" style={{marginTop:18}}><label className="field"><span>Location</span><select name="locationId"><option value="">Default</option>{(locations?.items||[]).map((l:any)=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label><label className="field"><span>Payment status</span><select name="paymentStatus" defaultValue="pending"><option value="pending">Pending</option><option value="partially_paid">Partially paid</option><option value="paid">Paid</option></select></label><label className="field"><span>Method</span><select name="paymentMethod" defaultValue="cod"><option value="cod">COD</option><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option></select></label><label className="field"><span>Amount received</span><input name="paymentAmount" type="number" min="0" defaultValue="0"/></label><button className="primary-button" type="submit">Convert to order</button></form></>}
    </article></div>
  </>;
}
