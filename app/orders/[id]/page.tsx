import Link from "next/link";
import {notFound} from "next/navigation";
import {PageHeader} from "@/components/page-header";
import {StatusPill} from "@/components/status-pill";
import {adminRequest,getAdminOrderDetail} from "@/lib/admin-api";
import {cancelOrderAction,recordPaymentAction,updateOrderAction} from "../actions";

const money=(value:any)=>"Rs. "+Number(value||0).toLocaleString("en-PK");

export default async function OrderDetailPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const [detail,payments]=await Promise.all([
    getAdminOrderDetail(id),
    adminRequest<any>("/v1/admin/commerce/payments?orderId="+encodeURIComponent(id),0),
  ]);
  if(!detail) notFound();
  const order=detail.order;
  const update=updateOrderAction.bind(null,id);
  const cancel=cancelOrderAction.bind(null,id);
  const recordPayment=recordPaymentAction.bind(null,id);

  return <>
    <PageHeader eyebrow="ORDER" title={order.order_number} description="Payment, fulfillment, customer, item and operational history in one record.">
      <Link className="secondary-button" href="/orders">Back to orders</Link>
    <Link className="secondary-button" href={"/orders/"+id+"/edit"}>Edit order / return</Link></PageHeader>

    <section className="stats-grid">
      <article className="stat-card"><span>TOTAL</span><strong>{money(order.total)}</strong><small>{order.currency}</small></article>
      <article className="stat-card"><span>ORDER</span><strong>{order.status}</strong><small>{new Date(order.created_at).toLocaleString("en-PK")}</small></article>
      <article className="stat-card"><span>PAYMENT</span><strong>{order.payment_status}</strong><small>{order.payment_method||"—"}</small></article>
      <article className="stat-card"><span>FULFILLMENT</span><strong>{order.fulfillment_status}</strong><small>{order.shipping_method||"standard"}</small></article>
    </section>

    <section className="dashboard-grid">
      <article className="panel">
        <div className="panel-head"><div><span>ITEMS</span><h2>Order contents</h2></div></div>
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>ITEM</th><th>SKU</th><th>QTY</th><th>OPTIONS</th><th className="right">TOTAL</th></tr></thead>
          <tbody>{(detail.items||[]).map((item:any)=><tr key={item.id}>
            <td><b>{item.title}</b></td><td>{item.sku}</td><td>{item.quantity}</td>
            <td>{Object.entries(item.selected_options||{}).map(([k,v])=>k+": "+String(v)).join(" · ")||"—"}</td>
            <td className="right">{money(item.line_total)}</td>
          </tr>)}</tbody>
        </table></div>
      </article>

      <article className="panel settings-panel">
        <section className="settings-section">
          <h2>Customer & delivery</h2>
          <p><b>{order.customer_name}</b><br/>{order.customer_email}<br/>{order.customer_phone}</p>
          <p>{order.shipping_address?.line1}<br/>{order.shipping_address?.line2}<br/>{order.shipping_address?.city} {order.shipping_address?.region}<br/>{order.shipping_address?.country}</p>
          {order.terms_accepted_at&&<p style={{marginTop:14,fontSize:12}}>Terms accepted: <b>{new Date(order.terms_accepted_at).toLocaleString("en-PK")}</b></p>}
          {order.is_gift&&<div style={{marginTop:18,paddingTop:18,borderTop:"1px solid var(--line)"}}><span className="tag">GIFT ORDER</span><h3 style={{margin:"12px 0 6px"}}>Private gift message</h3><p>{order.gift_message||"No message supplied."}</p></div>}
        </section>
      </article>
    </section>

    {(detail.bundles||[]).length>0&&<section className="panel" style={{marginBottom:20,padding:24}}>
      <div className="panel-head"><div><span>BUNDLE ALLOCATIONS</span><h2>Sets in this order</h2></div></div>
      <p style={{fontSize:13,opacity:.75,marginBottom:15}}>Order items above represent the individual physical variants. Bundle savings are accounted for at order level.</p>
      <div className="activity-list">
        {(detail.bundles||[]).map((bundle:any,index:number)=><div className="activity-item" key={index}>
          <span>◇</span><div><b>{bundle.title_snapshot} × {bundle.quantity}</b>
          <p>Regular {money(bundle.gross_amount)} · Bundle saving {money(bundle.discount_amount)}</p>
          <small>Saved variant configuration is preserved for order auditing.</small></div>
          <em>{money(Number(bundle.gross_amount)-Number(bundle.discount_amount))}</em>
        </div>)}
      </div>
      <p style={{marginTop:15,fontSize:13}}><b>Total bundle discount:</b> {money(order.bundle_discount_amount)}</p>
    </section>}

    <section className="dashboard-grid lower">
      <article className="panel">
        <div className="panel-head"><div><span>PAYMENT LEDGER</span><h2>Transactions</h2></div></div>
        <div className="activity-list">
          {(payments?.items||[]).map((tx:any)=><div className="activity-item" key={tx.id}><span>•</span><div><b>{tx.transaction_type} · {money(tx.amount)}</b><p>{tx.provider} · {tx.provider_transaction_id||"No provider reference"}</p></div><em>{tx.status}</em></div>)}
          {!(payments?.items||[]).length&&<div className="activity-item"><span>•</span><div><b>No payment transactions</b><p>COD or pending orders may not have ledger entries yet.</p></div></div>}
        </div>
      </article>
      <form action={recordPayment} className="panel settings-panel">
        <section className="settings-section">
          <h2>Record transaction</h2>
          <div className="field-grid">
            <label className="field"><span>Type</span><select name="transactionType"><option value="capture">Payment / capture</option><option value="payment">Payment</option><option value="refund">Refund</option></select></label>
            <label className="field"><span>Status</span><select name="transactionStatus"><option value="succeeded">Succeeded</option><option value="failed">Failed</option><option value="pending">Pending</option></select></label>
            <label className="field"><span>Amount</span><input name="amount" type="number" min="0.01" step="0.01" required/></label>
            <label className="field"><span>Provider</span><input name="provider" defaultValue="manual" placeholder="manual / stripe / gateway"/></label>
            <label className="field"><span>Provider transaction ID</span><input name="providerTransactionId"/></label>
            <label className="field" style={{gridColumn:"1/-1"}}><span>Note</span><input name="paymentNote"/></label>
          </div>
          <button className="primary-button">Record payment transaction</button>
        </section>
      </form>
    </section>

    <section className="dashboard-grid lower">
      {order.status!=="canceled"&&order.fulfillment_status!=="returned"?<form action={update} className="panel settings-panel">
        <section className="settings-section">
          <h2>Operational state</h2>
          <div className="field-grid">
            <label className="field"><span>Order status</span><select name="status" defaultValue={order.status}><option>confirmed</option><option>processing</option><option>completed</option></select></label>
            <div className="field"><span>Payment status (ledger controlled)</span><p><b>{order.payment_status}</b></p><small>Use Record transaction above to reconcile payments and refunds.</small></div>
            <label className="field"><span>Fulfillment</span><select name="fulfillmentStatus" defaultValue={order.fulfillment_status}><option>unfulfilled</option><option>processing</option><option>fulfilled</option></select></label>
            <label className="field"><span>Tracking carrier</span><input name="trackingCarrier" defaultValue={order.tracking_carrier||""} placeholder="TCS, DHL, Leopards..."/></label>
            <label className="field"><span>Tracking number</span><input name="trackingNumber" defaultValue={order.tracking_number||""}/></label>
            <label className="field" style={{gridColumn:"1 / -1"}}><span>Tracking URL</span><input name="trackingUrl" type="url" defaultValue={order.tracking_url||""} placeholder="https://..."/></label>
            <label className="field" style={{gridColumn:"1 / -1"}}><span>Internal notes</span><textarea name="notes" rows={4} defaultValue={order.notes||""}/></label>
          </div>
          {order.tracking_number&&<p style={{marginTop:8}}>Tracking: <b>{order.tracking_carrier||"Carrier"}</b> · {order.tracking_number}{order.tracking_url&&<> · <a href={order.tracking_url} target="_blank" rel="noreferrer">Open tracking ↗</a></>}</p>}
          <button className="primary-button" type="submit">Save order</button>
        </section>
      </form>:<article className="panel"><h2>Order locked</h2><p>Canceled or returned orders cannot be modified through generic operations.</p></article>}

      <article className="panel">
        <div className="panel-head"><div><span>TIMELINE</span><h2>Order events</h2></div></div>
        <div className="activity-list">{(detail.events||[]).map((event:any)=><div className="activity-item" key={event.id}><span>•</span><div><b>{event.event_type}</b><p>{event.message}</p></div><time>{new Date(event.created_at).toLocaleString("en-PK")}</time></div>)}</div>
        {order.status!=="canceled"&& !["fulfilled","returned"].includes(order.fulfillment_status) && !["paid","partially_paid","partially_refunded"].includes(order.payment_status) &&<form action={cancel} style={{marginTop:20}}><label className="field"><span>Cancellation reason</span><input name="reason" placeholder="Customer request, duplicate order..."/></label><button className="secondary-button" type="submit">Cancel & restore inventory</button></form>}
        {order.fulfillment_status==="fulfilled"&&<div style={{marginTop:20}}><p>Returns must be recorded as inspected cases; the order is not automatically restocked or refunded.</p><Link className="secondary-button" href={"/orders/"+id+"/edit"}>Create return or exchange case →</Link></div>}
      </article>
    </section>
  </>;
}
