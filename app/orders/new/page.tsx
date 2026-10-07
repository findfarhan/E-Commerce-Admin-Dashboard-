import Link from "next/link";
import {PageHeader} from "@/components/page-header";
import {adminRequest,getAdminCustomers} from "@/lib/admin-api";
import {DraftOrderBuilder} from "@/components/draft-order-builder";

export default async function NewOrder(){
  const [catalog,locations,customers]=await Promise.all([
    adminRequest<any>("/v1/admin/commerce/order-catalog",0),
    adminRequest<any>("/v1/admin/commerce/locations",0),
    getAdminCustomers(),
  ]);
  return <div className="resource-create-page draft-order-page">
    <PageHeader eyebrow="ORDERS" title="Create order" description="Build the order as a draft first, then save it, mark it paid, or create the order when everything is ready.">
      <Link className="secondary-button" href="/draft-orders">View drafts</Link>
      <Link className="secondary-button" href="/orders">Cancel</Link>
    </PageHeader>
    <DraftOrderBuilder variants={catalog?.items||[]} locations={locations?.items||[]} customers={customers}/>
  </div>;
}