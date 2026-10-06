import {notFound} from "next/navigation";
import {ImageRenditionPipeline} from "@/components/image-rendition-pipeline";
import {PageHeader} from "@/components/page-header";
import {ProductSeoChannelManager} from "@/components/product-seo-channel-manager";
import {ProductVariantManager} from "@/components/product-variant-manager";
import {getAdminProductDetail} from "@/lib/admin-api";

export default async function ProductPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const detail=await getAdminProductDetail(id);
  if(!detail) notFound();

  const {product,options,variants,mediaSets}=detail;

  return <>
    <PageHeader eyebrow="PRODUCT STUDIO" title={product.name} description="Canonical product, sellable variants, visual media rules, responsive delivery, SEO and channel overlays."/>

    <article className="panel product-summary-card">
      <div className="product-summary-thumb"/>
      <div className="product-summary-copy">
        <span>{product.sku}</span>
        <h2>{product.name}</h2>
        <p>Jewelry Store · canonical product identity</p>
      </div>
      <div className="product-summary-stats">
        <div><span>VARIANTS</span><b>{product.variantCount}</b></div>
        <div><span>MEDIA SETS</span><b>{product.mediaSetCount}</b></div>
        <div><span>STOCK</span><b>{product.inventory}</b></div>
      </div>
    </article>

    {options.length
      ? <ProductVariantManager options={options} variants={variants} mediaSets={mediaSets}/>
      : <article className="panel empty-panel"><div><h2>No product options configured</h2><p>This product is currently a single/default variant. Add visual or sizing options when needed.</p></div></article>
    }

    <div style={{marginTop:14}}><ImageRenditionPipeline/></div>
    <div style={{marginTop:14}}><ProductSeoChannelManager productId={id}/></div>
  </>;
}
