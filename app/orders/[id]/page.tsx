import Link from "next/link";
import {notFound} from "next/navigation";
import {PageHeader} from "@/components/page-header";
import {StatusPill} from "@/components/status-pill";
import {getAdminOrderDetail} from "@/lib/admin-api";
import {cancelOrderAction,returnOrderAction,updateOrderAction} from "../actions";

const money=(value:any)=>"Rs. "+Number(value||0).toLocaleString("en-PK");

export default async function OrderDetailPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const detail=await getAdminOrderDetail(id);
  if(!detail) notFound();
  const order=detail.order;
  const update=updateOrderAction.bind(null,id);
  const cancel=cancelOrderAction.bind(null,id);
  const returnOrder=returnOrderAction.bind(null,id);

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

    <section className="dashboard-grid lower">
      <form action={update} className="panel settings-panel">
        <section className="settings-section">
          <h2>Operational state</h2>
          <div className="field-grid">
            <label className="field"><span>Order status</span><select name="status" defaultValue={order.status}><option>confirmed</option><option>processing</option><option>completed</option></select></label>
            <label className="field"><span>Payment status</span><select name="paymentStatus" defaultValue={order.payment_status}><option>pending</option><option>paid</option><option>refunded</option><option>failed</option></select></label>
            <label className="field"><span>Fulfillment</span><select name="fulfillmentStatus" defaultValue={order.fulfillment_status}><option>unfulfilled</option><option>processing</option><option>fulfilled</option><option>returned</option></select></label>
            <label className="field"><span>Tracking carrier</span><input name="trackingCarrier" defaultValue={order.tracking_carrier||""} placeholder="TCS, DHL, Leopards..."/></label>
            <label className="field"><span>Tracking number</span><input name="trackingNumber" defaultValue={order.tracking_number||""}/></label>
            <label className="field" style={{gridColumn:"1 / -1"}}><span>Tracking URL</span><input name="trackingUrl" type="url" defaultValue={order.tracking_url||""} placeholder="https://..."/></label>
            <label className="field" style={{gridColumn:"1 / -1"}}><span>Internal notes</span><textarea name="notes" rows={4} defaultValue={order.notes||""}/></label>
          </div>
          {order.tracking_number&&<p style={{marginTop:8}}>Tracking: <b>{order.tracking_carrier||"Carrier"}</b> · {order.tracking_number}{order.tracking_url&&<> · <a href={order.tracking_url} target="_blank" rel="noreferrer">Open tracking ↗</a></>}</p>}
          <button className="primary-button" type="submit">Save order</button>
        </section>
      </form>

      <article className="panel">
        <div className="panel-head"><div><span>TIMELINE</span><h2>Order events</h2></div></div>
        <div className="activity-list">{(detail.events||[]).map((event:any)=><div className="activity-item" key={event.id}><span>•</span><div><b>{event.event_type}</b><p>{event.message}</p></div><time>{new Date(event.created_at).toLocaleString("en-PK")}</time></div>)}</div>
        {order.status!=="canceled"&&order.fulfillment_status!=="fulfilled"&&<form action={cancel} style={{marginTop:20}}><label className="field"><span>Cancellation reason</span><input name="reason" placeholder="Customer request, duplicate order..."/></label><button className="secondary-button" type="submit">Cancel & restore inventory</button></form>}
        {order.fulfillment_status==="fulfilled"&&<form action={returnOrder} style={{marginTop:20}}><label className="field"><span>Return reason</span><input name="reason" placeholder="Returned by customer, damaged in transit..."/></label><button className="secondary-button" type="submit">Mark returned & restock</button></form>}
      </article>
    </section>
  </>;
}
