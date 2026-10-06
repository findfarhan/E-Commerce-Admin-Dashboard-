import Link from "next/link";
import {PageHeader} from "@/components/page-header";
import {ReturnBuilder} from "@/components/return-builder";
import {adminRequest} from "@/lib/admin-api";
import {createReturnAction} from "@/app/enterprise-actions";

export default async function NewReturnPage({searchParams}:{searchParams:Promise<{orderId?:string}>}){
 const {orderId}=await searchParams;
 const [orders,catalog]=await Promise.all([adminRequest<any>("/v1/admin/orders",0),adminRequest<any>("/v1/admin/order-catalog",0)]);
 if(!orderId) return <><PageHeader eyebrow="RETURNS / NEW" title="Choose an order" description="Select the fulfilled or delivered order that needs a return or exchange."/>
 <div className="panel table-wrap"><table className="data-table"><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>FULFILLMENT</th><th>TOTAL</th><th></th></tr></thead><tbody>{(orders?.items||[]).map((o:any)=><tr key={o.id}><td><b>{o.order_number}</b></td><td>{o.customer_name||"Guest"}</td><td>{o.fulfillment_status}</td><td>Rs. {Number(o.total).toLocaleString("en-PK")}</td><td><Link className="secondary-button" href={"/returns/new?orderId="+o.id}>Select</Link></td></tr>)}</tbody></table></div></>;
 const detail=await adminRequest<any>("/v1/admin/orders/"+encodeURIComponent(orderId),0);
 return <><PageHeader eyebrow="RETURNS / NEW" title={"Return "+(detail?.order?.order_number||"order")} description="Choose lines, condition, restock behavior, refund and optional exchange variant."/><ReturnBuilder action={createReturnAction} orderId={orderId} items={detail?.items||[]} catalog={catalog?.items||[]}/></>;
}
