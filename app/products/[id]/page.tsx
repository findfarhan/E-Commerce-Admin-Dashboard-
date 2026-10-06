import {notFound} from "next/navigation";
import {ImageRenditionPipeline} from "@/components/image-rendition-pipeline";
import {PageHeader} from "@/components/page-header";
import {ProductSeoChannelManager} from "@/components/product-seo-channel-manager";
import {ProductVariantManager} from "@/components/product-variant-manager";
import {productMediaSetsByProduct,productOptionsByProduct,products,productVariantsByProduct} from "@/lib/mock-data";

export default async function ProductPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const product=products.find(x=>x.id===id);
  if(!product)notFound();
  const options=productOptionsByProduct[id]??[];
  const variants=productVariantsByProduct[id]??[];
  const mediaSets=productMediaSetsByProduct[id]??[];
  return <><PageHeader eyebrow="PRODUCT STUDIO" title={product.name} description="Canonical product, sellable variants, visual media rules, responsive renditions, SEO and channel overlays."/><article className="panel product-summary-card"><div className="product-summary-thumb"/><div className="product-summary-copy"><span>{product.sku}</span><h2>{product.name}</h2><p>Jewelry Store · canonical product identity</p></div><div className="product-summary-stats"><div><span>VARIANTS</span><b>{product.variantCount}</b></div><div><span>MEDIA SETS</span><b>{product.mediaSetCount}</b></div><div><span>STOCK</span><b>{product.inventory}</b></div></div></article>{options.length?<ProductVariantManager options={options} variants={variants} mediaSets={mediaSets}/>:<article className="panel empty-panel"><div><h2>No variant studio configured</h2><p>Add options to activate the same visual-option and media-set engine.</p></div></article>}<div style={{marginTop:14}}><ImageRenditionPipeline/></div><div style={{marginTop:14}}><ProductSeoChannelManager productId={id}/></div></>}