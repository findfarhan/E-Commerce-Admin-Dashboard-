import Link from "next/link";
import {PageHeader} from "@/components/page-header";
import {getAdminCustomers} from "@/lib/admin-api";

export default async function Customers(){
  const customers=await getAdminCustomers();
  return <>
    <PageHeader eyebrow="CRM" title="Customers" description="Customer identity, segments, order history and lifetime value."/>
    <div className="panel table-wrap">
      <table className="data-table">
        <thead><tr><th>CUSTOMER</th><th>SEGMENT</th><th>ORDERS</th><th>LTV</th><th>LAST ORDER</th></tr></thead>
        <tbody>
          {customers.map(c=><tr key={c.id}>
            <td><Link href={"/customers/"+c.id}><div className="customer-cell"><span>{c.name.split(" ").map(x=>x[0]).join("").slice(0,2)}</span><div><b>{c.name}</b><small>{c.email}</small></div></div></Link></td>
            <td><span className="tag">{c.segment}</span></td>
            <td>{c.orders}</td>
            <td>Rs. {c.lifetimeValue.toLocaleString("en-PK")}</td>
            <td>{c.lastOrderAt}</td>
          </tr>)}
          {!customers.length&&<tr><td colSpan={5}>No customers yet.</td></tr>}
        </tbody>
      </table>
    </div>
  </>;
}
