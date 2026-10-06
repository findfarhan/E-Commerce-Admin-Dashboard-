import {notFound} from "next/navigation";
import {PageHeader} from "@/components/page-header";
import {StatusPill} from "@/components/status-pill";
import {adminRequest} from "@/lib/admin-api";
import {placePurchaseOrderAction,receivePurchaseOrderAction} from "@/app/enterprise-actions";

export default async function PurchaseOrderDetail({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const data=await adminRequest<any>("/v1/admin/purchase-orders/"+id,0);if(!data) notFound();
 const po=data.purchaseOrder,items=data.items||[];
 const place=placePurchaseOrderAction.bind(null,id),receive=receivePurchaseOrderAction.bind(null,id);
 const receiveJson=JSON.stringify(items.filter((i:any)=>Number(i.received_quantity)<Number(i.quantity)).map((i:any)=>({itemId:i.id,quantity:Number(i.quantity)-Number(i.received_quantity)})));
 return <><PageHeader eyebrow="PURCHASE ORDER" title={po.po_number} description={(po.supplier_name||"No supplier")+" · "+(po.location_name||"No location")}><StatusPill tone={po.status==="received"?"success":po.status==="ordered"?"info":"neutral"}>{po.status}</StatusPill></PageHeader>
 <section className="dashboard-grid"><article className="panel"><div className="table-wrap"><table className="data-table"><thead><tr><th>ITEM</th><th>SKU</th><th>ORDERED</th><th>RECEIVED</th><th>COST</th><th className="right">TOTAL</th></tr></thead><tbody>{items.map((i:any)=><tr key={i.id}><td>{i.title}</td><td>{i.sku}</td><td>{i.quantity}</td><td>{i.received_quantity}</td><td>Rs. {Number(i.unit_cost).toLocaleString("en-PK")}</td><td className="right">Rs. {Number(i.line_total).toLocaleString("en-PK")}</td></tr>)}</tbody></table></div></article><article className="panel enterprise-card"><h3>Receiving workflow</h3><p>Draft → ordered marks quantities as incoming. Receive moves incoming stock to available and updates weighted cost.</p>{po.status==="draft"&&<form action={place}><button className="primary-button" type="submit">Place purchase order</button></form>}{["ordered","partially_received"].includes(po.status)&&<form action={receive}><input type="hidden" name="itemsJson" value={receiveJson}/><button className="primary-button" type="submit">Receive all remaining</button></form>}</article></section></>;
}
