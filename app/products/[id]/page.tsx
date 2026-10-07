import Link from "next/link";
import {notFound} from "next/navigation";
import {PageHeader} from "@/components/page-header";
import {ShopifyVariantSection} from "@/components/shopify-variant-section";
import {MediaUploader} from "@/components/media-uploader";
import {adminRequest,getAdminProductDetail,getAdminSeo} from "@/lib/admin-api";
import {
  createMediaSetAction,createSourceMediaAction,deleteMediaAction,updateMediaAction,
  archiveProductAction,duplicateProductAction,saveProductSeoAction,saveProductMetafieldsAction
} from "../actions";

export default async function ProductPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const detail=await getAdminProductDetail(id);
  if(!detail) notFound();

  const {product,options,variants,mediaSets,media}=detail;
  const [seo,metafieldDefs,metafieldValues]=await Promise.all([
    getAdminSeo("product",id),
    adminRequest<any>("/v1/admin/commerce/metafield-definitions?resourceType=product",0),
    adminRequest<any>("/v1/admin/commerce/metafields/product/"+encodeURIComponent(id),0)
  ]);
  const addMediaSet=createMediaSetAction.bind(null,id);
  const saveSeo=saveProductSeoAction.bind(null,id,product.handle||"");
  const archiveProduct=archiveProductAction.bind(null,id);
  const duplicateProduct=duplicateProductAction.bind(null,id);
  const visualOptions=options.filter(option=>option.isVisual);
  const addSourceMedia=createSourceMediaAction.bind(null,id);
  const saveMetafields=saveProductMetafieldsAction.bind(null,id);
  const metafieldMap=new Map<string,any>((metafieldValues?.items||[]).map((x:any)=>[x.definition_id,x]));

  return <div className="shopify-product-page">
    <PageHeader eyebrow="PRODUCTS" title={product.name} description="Manage product information, variants, media, custom data and search presentation.">
      <Link className="secondary-button" href={"/products/"+id+"/edit"}>Edit product</Link>
      <form action={duplicateProduct}><button className="secondary-button" type="submit">Duplicate</button></form>
      <form action={archiveProduct}><button className="secondary-button" type="submit">Archive</button></form>
      <Link className="secondary-button" href="/products">Back</Link>
    </PageHeader>

    <article className="shopify-admin-card product-overview-card">
      <div className="product-overview-image">◇</div>
      <div><span>{product.status}</span><h2>{product.name}</h2><p>{product.sku} · {product.category||"Jewelry"} · {product.material||"Material not set"}</p></div>
      <div className="product-overview-metrics"><div><span>Variants</span><b>{variants.length}</b></div><div><span>Available</span><b>{product.inventory}</b></div><div><span>Starting price</span><b>Rs. {product.price.toLocaleString("en-PK")}</b></div></div>
    </article>

    <ShopifyVariantSection productId={id} productSku={product.sku} productPrice={product.price} options={options} variants={variants} mediaSets={mediaSets}/>

    <section className="shopify-admin-card product-section-card">
      <div className="shopify-card-heading"><div><h2>Media</h2><p>Upload product images once, then optionally map visual sets to appearance-changing variants.</p></div></div>
      <MediaUploader productId={id} mediaSets={mediaSets.map(x=>({id:x.id,name:x.name}))}/>
      <details className="product-secondary-details">
        <summary>Advanced media settings</summary>
        {visualOptions.length>0&&<form action={addMediaSet} className="shopify-inline-form">
          <label className="shopify-admin-field"><span>Media set name</span><input name="name" required placeholder="Yellow Gold + Diamond"/></label>
          {visualOptions.map(option=><label className="shopify-admin-field" key={option.id}><span>{option.name}</span><select name={"visual__"+option.name}>{option.values.map(value=><option key={value.id} value={value.value}>{value.value}</option>)}</select></label>)}
          <label className="shopify-admin-check compact"><input name="isDefault" type="checkbox"/><span><b>Default set</b><small>Use when no exact visual match exists.</small></span></label>
          <button className="secondary-button">Create media set</button>
        </form>}
        <form action={addSourceMedia} className="shopify-inline-form">
          <label className="shopify-admin-field"><span>HTTPS image URL</span><input name="sourceUrl" type="url" required placeholder="https://…"/></label>
          <label className="shopify-admin-field"><span>Alt text</span><input name="altText"/></label>
          <label className="shopify-admin-field"><span>Role</span><select name="role"><option value="gallery">Gallery</option><option value="primary">Primary</option></select></label>
          <label className="shopify-admin-field"><span>Media set</span><select name="mediaSetId"><option value="">General</option>{mediaSets.map(set=><option key={set.id} value={set.id}>{set.name}</option>)}</select></label>
          <input type="hidden" name="position" value="0"/>
          <button className="secondary-button">Add source image</button>
        </form>
      </details>

      {(media||[]).length>0&&<div className="product-media-admin-list">
        {(media||[]).map((item:any)=>{
          const update=updateMediaAction.bind(null,id,item.id);
          const remove=deleteMediaAction.bind(null,id,item.id);
          return <div className="product-media-admin-row" key={item.id}>
            <div>{(item.responsive?.admin_thumb||item.url||item.sourceUrl)?<img src={item.responsive?.admin_thumb||item.url||item.sourceUrl} alt={item.altText||""}/>:<span>◇</span>}</div>
            <div><b>{item.altText||"Product image"}</b><small>{item.role||"gallery"} · position {item.position||0}</small></div>
            <details><summary>•••</summary><div><form action={update}><label><span>Alt text</span><input name="altText" defaultValue={item.altText||""}/></label><input type="hidden" name="role" value={item.role||"gallery"}/><input type="hidden" name="position" value={item.position||0}/><input type="hidden" name="mediaSetId" value={item.mediaSetId||""}/><input type="hidden" name="focalX" value={item.focalX??0.5}/><input type="hidden" name="focalY" value={item.focalY??0.5}/><button className="secondary-button">Save</button></form><form action={remove}><button className="text-danger">Delete image</button></form></div></details>
          </div>;
        })}
      </div>}
    </section>

    <section className="shopify-admin-card product-section-card">
      <div className="shopify-card-heading"><div><h2>Metafields</h2><p>Custom product data defined in Settings → Product metafields.</p></div><Link className="text-action" href="/metafields">Manage definitions</Link></div>
      {(metafieldDefs?.items||[]).length?<form action={saveMetafields} className="product-metafield-grid">
        <input type="hidden" name="__definitions" value={JSON.stringify((metafieldDefs?.items||[]).map((x:any)=>({id:x.id,namespace:x.namespace,key:x.key,value_type:x.value_type})))}/>
        {(metafieldDefs?.items||[]).map((definition:any)=>{
          const current=metafieldMap.get(definition.id);
          const raw=current?.value;
          const value=Array.isArray(raw)?raw.join(", "):typeof raw==="object"&&raw!==null?JSON.stringify(raw):String(raw??"");
          return <label className="shopify-admin-field" key={definition.id}><span>{definition.name}</span>{definition.value_type==="boolean"?<select name={"metafield__"+definition.id} defaultValue={value||"false"}><option value="false">False</option><option value="true">True</option></select>:<input name={"metafield__"+definition.id} defaultValue={value} placeholder={String(definition.value_type).replaceAll("_"," ")}/>}<small>{definition.namespace}.{definition.key}</small></label>;
        })}
        <div><button className="secondary-button">Save metafields</button></div>
      </form>:<div className="catalog-empty small"><b>No product metafields</b><span>Create definitions to add structured jewelry data.</span><Link className="secondary-button" href="/metafields">Add definition</Link></div>}
    </section>

    <section className="shopify-admin-card product-section-card">
      <div className="shopify-card-heading"><div><h2>Search engine listing</h2><p>Control how this product appears in search results.</p></div></div>
      <div className="seo-preview-card"><span className="seo-preview-url">https://store.example/product/{product.handle}</span><b>{seo?.title||product.name}</b><p>{seo?.meta_description||product.description||"Add a search description for this product."}</p></div>
      <form action={saveSeo} className="shopify-seo-form">
        <label className="shopify-admin-field"><span>Page title</span><input name="title" defaultValue={seo?.title||product.name+" | Jewelry Store"}/></label>
        <label className="shopify-admin-field"><span>Meta description</span><textarea name="metaDescription" rows={3} defaultValue={seo?.meta_description||product.description||""}/></label>
        <label className="shopify-admin-field"><span>URL</span><input name="canonicalPath" defaultValue={seo?.canonical_path||("/product/"+(product.handle||""))}/></label>
        <label className="shopify-admin-check compact"><input name="index" type="checkbox" defaultChecked={seo?.robots_index!==false}/><span><b>Index in search</b><small>Allow search engines to index this product.</small></span></label>
        <button className="secondary-button">Save search listing</button>
      </form>
    </section>
  </div>;
}
