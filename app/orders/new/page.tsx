import {PageHeader} from "@/components/page-header";
import {OrderBuilder} from "@/components/order-builder";
import {adminRequest} from "@/lib/admin-api";
import {createManualOrderAction} from "@/app/enterprise-actions";

export default async function NewOrderPage(){
  const [catalog,customers,locations,shipping]=await Promise.all([
    adminRequest<any>("/v1/admin/order-catalog",0),
    adminRequest<any>("/v1/admin/customers",0),
    adminRequest<any>("/v1/admin/locations",0),
    adminRequest<any>("/v1/admin/shipping",0),
  ]);
  return <>
    <PageHeader eyebrow="ORDERS / MANUAL" title="Create manual order" description="Create a server-priced admin order with customer, negotiated line prices, discount, shipping, tax and location-aware stock deduction."/>
    <OrderBuilder action={createManualOrderAction} mode="manual" catalog={catalog?.items||[]} customers={customers?.items||[]} locations={locations?.items||[]} shippingRates={shipping?.rates||[]}/>
  </>;
}
