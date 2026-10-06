import Link from "next/link";
import {notFound} from "next/navigation";
import {ImageRenditionPipeline} from "@/components/image-rendition-pipeline";
import {PageHeader} from "@/components/page-header";
import {ProductSeoChannelManager} from "@/components/product-seo-channel-manager";
import {ProductVariantManager} from "@/components/product-variant-manager";
import {getAdminProductDetail} from "@/lib/admin-api";
import {createMediaSetAction,createOptionAction,createVariantAction} from "../actions";

export default async function ProductPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const detail=await getAdminProductDetail(id);
  if(!detail) notFound();

  const {product,options,variants,mediaSets}=detail;
  const addOption=createOptionAction.bind(null,id);
  const addVariant=createVariantAction.bind(null,id);
  const addMediaSet=createMediaSetAction.bind(null,id);
  const visualOptions=options.filter(option=>option.isVisual);

  return <>
    <PageHeader eyebrow="PRODUCT STUDIO" title={product.name} description="Canonical product, sellable variants, visual media rules, responsive delivery, SEO and channel overlays.">
      <Link className="secondary-button" href={"/products/"+id+"/edit"}>Edit core</Link>
      <Link className="primary-button" href="/products">Catalog</Link>
    </PageHeader>

    <article className="panel product-summary-card">
      <div className="product-summary-thumb"/>
      <div className="product-summary-copy">
        <span>{product.sku}</span>
        <h2>{product.name}</h2>
        <p>{product.category||"Jewelry"} · {product.material||"Canonical product"}</p>
      </div>
      <div className="product-summary-stats">
        <div><span>VARIANTS</span><b>{product.variantCount}</b></div>
        <div><span>MEDIA SETS</span><b>{product.mediaSetCount}</b></div>
        <div><span>STOCK</span><b>{product.inventory}</b></div>
      </div>
    </article>

    {options.length
      ? <ProductVariantManager options={options} variants={variants} mediaSets={mediaSets}/>
      : <article className="panel empty-panel"><div><h2>No product options configured</h2><p>This product is currently a single/default variant. Add visual or sizing options below when needed.</p></div></article>
    }

    <section className="settings-grid" style={{marginTop:14}}>
      <article className="panel settings-panel">
        <section className="settings-section">
          <h2>Add option</h2>
          <p>Use visual options for appearance-changing choices such as metal or stone. Size should normally remain non-visual.</p>
          <form action={addOption} className="field-grid">
            <label className="field"><span>Name</span><input name="name" required placeholder="Metal"/></label>
            <label className="field"><span>Values</span><input name="values" required placeholder="Yellow Gold, White Gold, Rose Gold"/></label>
            <label className="field"><span>Position</span><input name="position" type="number" min="0" defaultValue={options.length}/></label>
            <label className="field"><span>Visual option</span><input name="isVisual" type="checkbox"/></label>
            <div className="page-actions"><button className="primary-button" type="submit">Add option</button></div>
          </form>
        </section>
      </article>

      <article className="panel settings-panel">
        <section className="settings-section">
          <h2>Add sellable variant</h2>
          <p>Create an exact SKU from the current option values. Inventory and price remain variant-level.</p>
          {options.length?<form action={addVariant} className="field-grid">
            {options.map(option=><label className="field" key={option.id}><span>{option.name}</span><select name={"option__"+option.name}>{option.values.map(value=><option key={value.id} value={value.value}>{value.value}</option>)}</select></label>)}
            <label className="field"><span>SKU</span><input name="sku" required placeholder="CEL-YG-DIA-7"/></label>
            <label className="field"><span>Price (PKR)</span><input name="price" type="number" min="0" required/></label>
            <label className="field"><span>Compare-at price</span><input name="compareAtPrice" type="number" min="0"/></label>
            <label className="field"><span>Inventory</span><input name="inventory" type="number" min="0" defaultValue="0"/></label>
            <label className="field"><span>Media set</span><select name="mediaSetId" defaultValue=""><option value="">Automatic / none</option>{mediaSets.map(set=><option key={set.id} value={set.id}>{set.name}</option>)}</select></label>
            <label className="field"><span>Status</span><select name="status" defaultValue="active"><option value="active">Active</option><option value="draft">Draft</option></select></label>
            <div className="page-actions"><button className="primary-button" type="submit">Create variant</button></div>
          </form>:<p>Add at least one option first.</p>}
        </section>
      </article>
    </section>

    {visualOptions.length>0&&<article className="panel settings-panel" style={{marginTop:14}}>
      <section className="settings-section">
        <h2>Create visual media set</h2>
        <p>Map a gallery to visual choices only. Non-visual options such as size can share the same images.</p>
        <form action={addMediaSet} className="field-grid">
          <label className="field"><span>Set name</span><input name="name" required placeholder="Yellow Gold + Diamond"/></label>
          {visualOptions.map(option=><label className="field" key={option.id}><span>{option.name}</span><select name={"visual__"+option.name}>{option.values.map(value=><option key={value.id} value={value.value}>{value.value}</option>)}</select></label>)}
          <label className="field"><span>Default set</span><input name="isDefault" type="checkbox"/></label>
          <div className="page-actions"><button className="primary-button" type="submit">Create media set</button></div>
        </form>
      </section>
    </article>}

    <div style={{marginTop:14}}><ImageRenditionPipeline/></div>
    <div style={{marginTop:14}}><ProductSeoChannelManager productId={id}/></div>
  </>;
}
