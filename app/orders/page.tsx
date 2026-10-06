import {PageHeader} from "@/components/page-header";
import {StatusPill} from "@/components/status-pill";
import {getAdminOrders} from "@/lib/admin-api";

export default async function Orders(){
  const orders=await getAdminOrders();
  return <>
    <PageHeader eyebrow="COMMERCE" title="Orders" description="Normalized orders regardless of sales channel."/>
    <div className="panel table-wrap">
      <table className="data-table">
        <thead><tr><th>ORDER</th><th>CUSTOMER</th><th>PAYMENT</th><th>STATUS</th><th className="right">TOTAL</th></tr></thead>
        <tbody>
          {orders.map(o=><tr key={o.id}>
            <td className="order-id">{o.number}<small>{o.createdAt}</small></td>
            <td>{o.customer}<small>{o.email}</small></td>
            <td><StatusPill tone={o.paymentStatus==="paid"?"success":"warning"}>{o.paymentStatus}</StatusPill></td>
            <td>{o.status}</td>
            <td className="right">Rs. {o.total.toLocaleString("en-PK")}</td>
          </tr>)}
          {!orders.length&&<tr><td colSpan={5}>No orders have been created yet.</td></tr>}
        </tbody>
      </table>
    </div>
  </>;
}
