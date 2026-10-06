import Link from "next/link";
import {notFound} from "next/navigation";
import {PageHeader} from "@/components/page-header";
import {adminRequest} from "@/lib/admin-api";
import {addCustomerAddressAction,addCustomerNoteAction,deleteCustomerAddressAction,setCustomerTagsAction} from "../actions";

const money=(value:any)=>"Rs. "+Number(value||0).toLocaleString("en-PK");

export default async function CustomerDetailPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const detail=await adminRequest<any>("/v1/admin/customers/"+encodeURIComponent(id)+"/profile",0);
  if(!detail) notFound();
  const customer=detail.customer;
  const metrics=detail.metrics||{};
  const note=addCustomerNoteAction.bind(null,id);
  const address=addCustomerAddressAction.bind(null,id);
  const tags=setCustomerTagsAction.bind(null,id);

  return <>
    <PageHeader eyebrow="CRM / CUSTOMER" title={customer.name||"Customer"} description="Identity, addresses, tags, lifetime value, order timeline and relationship notes.">
      <Link className="secondary-button" href="/customers">Back</Link>
    </PageHeader>

    <section className="stats-grid">
      <article className="stat-card"><span>ORDERS</span><strong>{Number(metrics.orders||0)}</strong><small>Total orders</small></article>
      <article className="stat-card"><span>LIFETIME VALUE</span><strong>{money(metrics.lifetime_value)}</strong><small>Recorded order value</small></article>
      <article className="stat-card"><span>AOV</span><strong>{money(metrics.aov)}</strong><small>Average order value</small></article>
      <article className="stat-card"><span>LAST ORDER</span><strong style={{fontSize:16}}>{metrics.last_order_at?new Date(metrics.last_order_at).toLocaleDateString("en-PK"):"—"}</strong><small>{customer.email||customer.phone||"No contact"}</small></article>
    </section>

    <section className="dashboard-grid">
      <article className="panel">
        <div className="panel-head"><div><span>ORDER TIMELINE</span><h2>Customer orders</h2></div></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>ORDER</th><th>DATE</th><th>STATUS</th><th>PAYMENT</th><th>FULFILLMENT</th><th className="right">TOTAL</th></tr></thead>
        <tbody>{(detail.orders||[]).map((order:any)=><tr key={order.id}><td><Link href={"/orders/"+order.id}><b>{order.order_number}</b></Link></td><td>{new Date(order.created_at).toLocaleDateString("en-PK")}</td><td>{order.status}</td><td>{order.payment_status}</td><td>{order.fulfillment_status}</td><td className="right">{money(order.total)}</td></tr>)}</tbody></table></div>
      </article>
      <article className="panel settings-panel">
        <section className="settings-section"><h2>Customer tags</h2><form action={tags}><label className="field"><span>Tags</span><input name="tags" defaultValue={(detail.tags||[]).join(", ")} placeholder="VIP, ring-size-known, bespoke"/></label><button className="primary-button" type="submit">Save tags</button></form></section>
        <section className="settings-section"><h2>Internal notes</h2><form action={note}><label className="field"><span>Add note</span><textarea name="note" rows={4} required placeholder="Sizing preference, custom request, VIP context..."/></label><button className="primary-button" type="submit">Add note</button></form><div className="activity-list" style={{marginTop:18}}>{(detail.notes||[]).map((item:any)=><div className="activity-item" key={item.id}><span>•</span><div><b>{item.author||"admin"}</b><p>{item.note}</p></div><time>{new Date(item.created_at).toLocaleDateString("en-PK")}</time></div>)}</div></section>
      </article>
    </section>

    <section className="dashboard-grid" style={{marginTop:14}}>
      <article className="panel enterprise-card"><h3>Addresses</h3>{(detail.addresses||[]).map((item:any)=><div className="metric-row" key={item.id}><span><b>{item.label||item.address_type}</b><br/>{item.recipient_name||customer.name||""} · {item.line1}{item.line2?", "+item.line2:""}, {item.city}{item.region?", "+item.region:""}, {item.country}</span><span>{item.is_default_shipping?"Default shipping ":""}{item.is_default_billing?"Default billing":""}<form action={deleteCustomerAddressAction.bind(null,id,item.id)}><button className="secondary-button" type="submit">Remove</button></form></span></div>)}{!(detail.addresses||[]).length&&<p>No saved addresses yet.</p>}</article>
      <article className="panel enterprise-card"><h3>Add address</h3><form action={address} className="field-grid" style={{marginTop:16}}><label className="field"><span>Type</span><select name="addressType"><option value="shipping">Shipping</option><option value="billing">Billing</option><option value="both">Both</option></select></label><label className="field"><span>Label</span><input name="label" placeholder="Home"/></label><label className="field"><span>Recipient</span><input name="recipientName" defaultValue={customer.name||""}/></label><label className="field"><span>Phone</span><input name="phone" defaultValue={customer.phone||""}/></label><label className="field" style={{gridColumn:"1 / -1"}}><span>Address line 1</span><input name="line1" required/></label><label className="field"><span>Address line 2</span><input name="line2"/></label><label className="field"><span>City</span><input name="city" required/></label><label className="field"><span>Region</span><input name="region"/></label><label className="field"><span>Postal code</span><input name="postalCode"/></label><label className="field"><span>Country</span><input name="country" defaultValue="Pakistan" required/></label><label className="field"><span>Default shipping</span><input name="isDefaultShipping" type="checkbox"/></label><label className="field"><span>Default billing</span><input name="isDefaultBilling" type="checkbox"/></label><button className="primary-button" type="submit">Save address</button></form></article>
    </section>
  </>;
}
