import {PageHeader} from "@/components/page-header";
import {adminRequest} from "@/lib/admin-api";
import {MetafieldDefinitionsManager} from "@/components/metafield-definitions-manager";

export default async function Metafields(){
  const response=await adminRequest<any>("/v1/admin/commerce/metafield-definitions?resourceType=product",0);
  const items=response?.items||[];
  return <div className="shopify-editor-page metafield-settings-page">
    <PageHeader eyebrow="SETTINGS / CUSTOM DATA" title="Product metafields" description="Create structured product fields with consistent types and discovery behavior."/>
    <section className="shopify-admin-card metafield-intro-card">
      <div><b>Product definitions</b><p>These definitions appear as custom fields on product records and can power storefront filters, smart collections and integrations.</p></div>
      <span>{items.length} definitions</span>
    </section>
    <section className="shopify-admin-card metafield-manager-card">
      <MetafieldDefinitionsManager items={items}/>
    </section>
  </div>;
}
