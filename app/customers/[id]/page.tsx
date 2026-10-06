import Link from "next/link";
import {notFound} from "next/navigation";
import {PageHeader} from "@/components/page-header";
import {adminRequest,getAdminCustomerDetail} from "@/lib/admin-api";
import {addCustomerAddressAction,addCustomerNoteAction,setCustomerTagsAction} from "../actions";

const money=(value:any)=>"Rs. "+Number(value||0).toLocaleString("en-PK");

export default async function CustomerDetailPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const [detail,addresses,tags]=await Promise.all([
    getAdminCustomerDetail(id),
    adminRequest<any>("/v1/admin/commerce/customers/"+encodeURIComponent(id)+"/addresses",0),
    adminRequest<any>("/v1/admin/commerce/customers/"+encodeURIComponent(id)+"/tags",0),
  ]);
  if(!detail) notFound();
  const customer=detail.customer;
  const note=addCustomerNoteAction.bind(null,id);
  const addAddress=addCustomerAddressAction.bind(null,id);
  const saveTags=setCustomerTagsAction.bind(null,id);
  const paidOrders=(detail.orders||[]).filter((o:any)=>["paid","partially_refunded","refunded"].includes(o.payment_status));
  const paidTotal=paidOrders.reduce((sum:number,o:any)=>sum+Number(o.total||0),0);
  const aov=paidOrders.length?paidTotal/paidOrders.length:0;
  const lastOrder=detail.orders?.[0];

  return <>
    <PageHeader eyebrow="CRM / CUSTOMER" title={customer.name||"Customer"} description="Identity, addresses, tags, order timeline, lifetime value and internal relationship context.">
      <Link className="secondary-button" href="/customers">Back</Link>
    </PageHeader>

    <section className="stats-grid">
      <article className="stat-card"><span>ORDERS</span><strong>{detail.orders?.length||0}</strong><small>Total orders</small></article>
      <article className="stat-card"><span>PAID LTV</span><strong>{money(paidTotal)}</strong><small>Captured commerce value</small></article>
      <article className="stat-card"><span>AOV</span><strong>{money(aov)}</strong><small>Paid average order value</small></article>
      <article className="stat-card"><span>LAST ORDER</span><strong style={{fontSize:18}}>{lastOrder?new Date(lastOrder.created_at).toLocaleDateString("en-PK"):"—"}</strong><small>{customer.email||"No email"}</small></article>
    </section>

    <section className="dashboard-grid">
      <article className="panel">
        <div className="panel-head"><div><span>ORDER TIMELINE</span><h2>Customer orders</h2></div></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>ORDER</th><th>STATUS</th><th>PAYMENT</th><th className="right">TOTAL</th></tr></thead>
        <tbody>{(detail.orders||[]).map((order:any)=><tr key={order.id}><td><Link href={"/orders/"+order.id}><b>{order.order_number}</b></Link><small>{new Date(order.created_at).toLocaleString("en-PK")}</small></td><td>{order.status}</td><td>{order.payment_status}</td><td className="right">{money(order.total)}</td></tr>)}</tbody></table></div>
      </article>

      <article className="panel settings-panel">
        <section className="settings-section">
          <h2>Customer tags</h2>
          <form action={saveTags} className="field-grid">
            <label className="field" style={{gridColumn:"1/-1"}}><span>Tags</span><input name="tags" defaultValue={(tags?.items||[]).map((x:any)=>x.name).join(", ")} placeholder="VIP, bridal, repeat, wholesale"/></label>
            <div className="page-actions"><button className="primary-button">Save tags</button></div>
          </form>
          <h2 style={{marginTop:24}}>Internal notes</h2>
          <form action={note}><label className="field"><span>Add note</span><textarea name="note" rows={4} required placeholder="Sizing preference, custom request, VIP context..."/></label><button className="primary-button" type="submit">Add note</button></form>
          <div className="activity-list" style={{marginTop:18}}>{(detail.notes||[]).map((item:any)=><div className="activity-item" key={item.id}><span>•</span><div><b>{item.author||"admin"}</b><p>{item.note}</p></div><time>{new Date(item.created_at).toLocaleDateString("en-PK")}</time></div>)}</div>
        </section>
      </article>
    </section>

    <section className="dashboard-grid lower">
      <article className="panel">
        <div className="panel-head"><div><span>ADDRESS BOOK</span><h2>Saved addresses</h2></div></div>
        <div className="activity-list">
          {(addresses?.items||[]).map((a:any)=><div className="activity-item" key={a.id}><span>•</span><div><b>{a.label||a.address_type}{a.is_default?" · Default":""}</b><p>{a.line1}{a.line2?", "+a.line2:""} · {a.city}{a.region?", "+a.region:""} · {a.country}</p><small>{a.name||customer.name} · {a.phone||customer.phone||"No phone"}</small></div></div>)}
          {!(addresses?.items||[]).length&&<div className="activity-item"><span>•</span><div><b>No saved addresses</b><p>Add the first shipping or billing address.</p></div></div>}
        </div>
      </article>

      <form action={addAddress} className="panel settings-panel">
        <section className="settings-section">
          <h2>Add address</h2>
          <div className="field-grid">
            <label className="field"><span>Label</span><input name="label" placeholder="Home / Office"/></label>
            <label className="field"><span>Type</span><select name="addressType"><option value="shipping">Shipping</option><option value="billing">Billing</option></select></label>
            <label className="field"><span>Recipient</span><input name="name" defaultValue={customer.name||""}/></label>
            <label className="field"><span>Phone</span><input name="phone" defaultValue={customer.phone||""}/></label>
            <label className="field"><span>Address line 1</span><input name="line1" required/></label>
            <label className="field"><span>Address line 2</span><input name="line2"/></label>
            <label className="field"><span>City</span><input name="city" required/></label>
            <label className="field"><span>Region</span><input name="region"/></label>
            <label className="field"><span>Postal code</span><input name="postalCode"/></label>
            <label className="field"><span>Country</span><input name="country" defaultValue="Pakistan"/></label>
            <label className="field"><span>Set default</span><input name="isDefault" type="checkbox"/></label>
          </div>
          <button className="primary-button">Save address</button>
        </section>
      </form>
    </section>
  </>;
}