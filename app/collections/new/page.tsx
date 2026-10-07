import Link from "next/link";
import {PageHeader} from "@/components/page-header";
import {getAdminProducts} from "@/lib/admin-api";
import {CollectionCreateEditor} from "@/components/collection-create-editor";

export default async function NewCollectionPage(){
  const products=await getAdminProducts();
  return <div className="shopify-editor-page">
    <PageHeader eyebrow="COLLECTIONS" title="Create collection" description="Build a manual or smart collection with a clear storefront and search configuration.">
      <Link className="secondary-button" href="/collections">Cancel</Link>
    </PageHeader>
    <CollectionCreateEditor products={products.map(p=>({id:p.id,name:p.name,sku:p.sku,status:p.status,category:p.category}))}/>
  </div>;
}
