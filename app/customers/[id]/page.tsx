import Link from "next/link";
import {notFound} from "next/navigation";
import {PageHeader} from "@/components/page-header";
import {getAdminCustomerDetail} from "@/lib/admin-api";
import {addCustomerNoteAction} from "../actions";

const money=(value:any)=>"Rs. "+Number(value||0).toLocaleString("en-PK");

export default async function CustomerDetailPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const detail=await getAdminCustomerDetail(id);
  if(!detail) notFound();
  const customer=detail.customer;
  const note=addCustomerNoteAction.bind(null,id);
  const paidTotal=(detail.orders||[]).filter((o:any)=>o.payment_status==="paid").reduce((sum:number,o:any)=>sum+Number(o.total||0),0);

  return <>
    <PageHeader eyebrow="CRM / CUSTOMER" title={customer.name||"Customer"} description="Identity, order history and internal relationship notes.">
      <Link className="secondary-button" href="/customers">Back</Link>
    </PageHeader>

    <section className="stats-grid">
      <article className="stat-card"><span>ORDERS</span><strong>{detail.orders?.length||0}</strong><small>Total orders</small></article>
      <article className="stat-card"><span>PAID LTV</span><strong>{money(paidTotal)}</strong><small>Confirmed paid revenue</small></article>
      <article className="stat-card"><span>EMAIL</span><strong style={{fontSize:18}}>{customer.email||"—"}</strong><small>Canonical contact</small></article>
      <article className="stat-card"><span>PHONE</span><strong style={{fontSize:18}}>{customer.phone||"—"}</strong><small>Contact</small></article>
    </section>

    <section className="dashboard-grid">
      <article className="panel">
        <div className="panel-head"><div><span>ORDER HISTORY</span><h2>Customer orders</h2></div></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>ORDER</th><th>STATUS</th><th>PAYMENT</th><th className="right">TOTAL</th></tr></thead>
        <tbody>{(detail.orders||[]).map((order:any)=><tr key={order.id}><td><Link href={"/orders/"+order.id}><b>{order.order_number}</b></Link></td><td>{order.status}</td><td>{order.payment_status}</td><td className="right">{money(order.total)}</td></tr>)}</tbody></table></div>
      </article>

      <article className="panel settings-panel">
        <section className="settings-section">
          <h2>Internal notes</h2>
          <form action={note}><label className="field"><span>Add note</span><textarea name="note" rows={4} required placeholder="Sizing preference, custom request, VIP context..."/></label><button className="primary-button" type="submit">Add note</button></form>
          <div className="activity-list" style={{marginTop:18}}>{(detail.notes||[]).map((item:any)=><div className="activity-item" key={item.id}><span>•</span><div><b>{item.author||"admin"}</b><p>{item.note}</p></div><time>{new Date(item.created_at).toLocaleDateString("en-PK")}</time></div>)}</div>
        </section>
      </article>
    </section>
  </>;
}
