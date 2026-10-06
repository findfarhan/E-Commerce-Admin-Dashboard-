import {PageHeader} from "@/components/page-header";
import {OrderBuilder} from "@/components/order-builder";
import {adminRequest} from "@/lib/admin-api";
import {createDraftOrderAction} from "@/app/enterprise-actions";

export default async function NewDraftOrderPage(){
  const [catalog,customers,locations,shipping]=await Promise.all([
    adminRequest<any>("/v1/admin/order-catalog",0),
    adminRequest<any>("/v1/admin/customers",0),
    adminRequest<any>("/v1/admin/locations",0),
    adminRequest<any>("/v1/admin/shipping",0),
  ]);
  return <>
    <PageHeader eyebrow="QUOTES / NEW" title="Create jewelry quote" description="Draft pricing can include negotiated line prices, discounts, shipping and tax before conversion to a real order."/>
    <OrderBuilder action={createDraftOrderAction} mode="draft" catalog={catalog?.items||[]} customers={customers?.items||[]} locations={locations?.items||[]} shippingRates={shipping?.rates||[]}/>
  </>;
}
