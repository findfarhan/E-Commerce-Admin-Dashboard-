import Link from "next/link";
import {PageHeader} from "@/components/page-header";
import {adminRequest} from "@/lib/admin-api";
import {ManualOrderBuilder} from "@/components/manual-order-builder";

export default async function NewOrder(){
  const [catalog,locations]=await Promise.all([adminRequest<any>("/v1/admin/commerce/order-catalog",0),adminRequest<any>("/v1/admin/commerce/locations",0)]);
  return <div className="resource-create-page"><PageHeader eyebrow="ORDERS" title="Create order" description="Add products, customer details, delivery, discounts and payment information."><Link className="secondary-button" href="/draft-orders">Draft orders</Link><Link className="secondary-button" href="/orders">Cancel</Link></PageHeader><ManualOrderBuilder variants={catalog?.items||[]} locations={locations?.items||[]}/></div>;
}
