import Link from "next/link";
import {notFound} from "next/navigation";
import {PageHeader} from "@/components/page-header";
import {ManagedMediaUpload} from "@/components/managed-media-upload";
import {ProductVariantManager} from "@/components/product-variant-manager";
import {adminRequest,getAdminProductDetail,getAdminSeo} from "@/lib/admin-api";
import {
  adjustInventoryAction,archiveVariantAction,createMediaSetAction,createOptionAction,createSourceMediaAction,createVariantAction,
  archiveProductAction,deleteMediaAction,deleteOptionAction,duplicateProductAction,generateVariantsAction,saveProductMetafieldsAction,
  saveProductSeoAction,saveVariantCostAction,updateMediaAction,updateOptionAction,updateVariantAction
} from "../actions";

export default async function ProductPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const detail=await getAdminProductDetail(id);
  if(!detail) notFound();

  const {product,options,mediaSets}=detail;
  const variants:any[]=detail.variants as any[];
  const media:any[]=(detail.media||[]) as any[];
  const [seo,metafieldResponse]=await Promise.all([
    getAdminSeo("product",id),
    adminRequest<any>("/v1/admin/metafields/product/"+encodeURIComponent(id),0),
  ]);
  const metafields:any[]=metafieldResponse?.items||[];
  const addOption=createOptionAction.bind(null,id);
  const addVariant=createVariantAction.bind(null,id);
  const addMediaSet=createMediaSetAction.bind(null,id);
  const generate=generateVariantsAction.bind(null,id);
  const saveSeo=saveProductSeoAction.bind(null,id,product.handle||"");
  const archiveProduct=archiveProductAction.bind(null,id);
  const duplicateProduct=duplicateProductAction.bind(null,id);
  const saveMetafields=saveProductMetafieldsAction.bind(null,id);
  const addSourceMedia=createSourceMediaAction.bind(null,id);
  const visualOptions=options.filter(option=>option.isVisual);

  return <>
    <PageHeader eyebrow="PRODUCT STUDIO" title={product.name} description="Canonical product, sellable variants, inventory, visual media rules, SEO and channel overlays.">
      <Link className="secondary-button" href={"/products/"+id+"/edit"}>Edit core</Link>
      <form action={duplicateProduct}><button className="secondary-button" type="submit">Duplicate</button></form>
      <form action={archiveProduct}><button className="secondary-button" type="submit">Archive product</button></form>
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

    <section className="enterprise-grid two" style={{marginTop:14}}>
      <article className="panel enterprise-card">
        <h3>Catalog organization</h3>
        <div className="metric-row"><span>Vendor / brand</span><b>{product.vendor||"—"}</b></div>
        <div className="metric-row"><span>Product type</span><b>{product.productType||"—"}</b></div>
        <div className="metric-row"><span>Tags</span><b>{(product.tags||[]).join(", ")||"—"}</b></div>
        <div className="metric-row"><span>Taxable</span><b>{product.taxable!==false?"Yes":"No"}</b></div>
        <div className="metric-row"><span>Weight</span><b>{product.weightGrams!==null&&product.weightGrams!==undefined?product.weightGrams+" g":"—"}</b></div>
        <div className="metric-row"><span>Publish schedule</span><b>{product.publishedAt?new Date(product.publishedAt).toLocaleString("en-PK"):"Immediate"}</b></div>
      </article>
      <form action={saveMetafields} className="panel enterprise-card">
        <h3>Jewelry metafields</h3>
        <p>Typed custom data is shared with search, filters, channels and storefront product detail.</p>
        <div className="field-grid" style={{marginTop:16}}>
          {metafields.map((field:any)=>{
            const name="mf__"+field.id;
            const raw=field.value;
            const value=raw===null||raw===undefined?"":typeof raw==="string"?raw:typeof raw==="object"?JSON.stringify(raw):String(raw);
            const allowed=Array.isArray(field.validation?.allowedValues)?field.validation.allowedValues:[];
            return <label className="field" key={field.id}>
              <input type="hidden" name={"mftype__"+field.id} value={field.value_type}/>
              <span>{field.name}<small style={{marginLeft:6}}>{field.namespace+"."+field.key}</small></span>
              {field.value_type==="boolean"
                ?<input name={name} type="checkbox" defaultChecked={Boolean(raw)}/>
                :allowed.length
                  ?<select name={name} defaultValue={value}><option value="">Not set</option>{allowed.map((option:string)=><option value={option} key={option}>{option}</option>)}</select>
                  :field.value_type==="multiline_text"||field.value_type==="json"
                    ?<textarea name={name} rows={3} defaultValue={value}/>
                    :<input name={name} type={field.value_type.startsWith("number")?"number":field.value_type==="date"?"date":field.value_type==="datetime"?"datetime-local":field.value_type==="url"?"url":"text"} step={field.value_type==="number_decimal"?"any":undefined} defaultValue={value}/>
              }
            </label>;
          })}
        </div>
        <div className="page-actions"><button className="primary-button" type="submit">Save metafields</button></div>
      </form>
    </section>

    {options.length
      ? <ProductVariantManager options={options} variants={variants} mediaSets={mediaSets}/>
      : <article className="panel empty-panel"><div><h2>No product options configured</h2><p>This product is currently a single/default variant. Add visual or sizing options below when needed.</p></div></article>
    }

    {options.length>0&&<article className="panel settings-panel" style={{marginTop:14}}>
      <section className="settings-section">
        <h2>Option definitions</h2>
        <p>Edit labels and values here. A value already attached to a sellable variant cannot be deleted until those variants are changed or archived.</p>
        <div className="seo-check-list">
          {options.map((option,index)=>{
            const update=updateOptionAction.bind(null,id,option.id);
            const remove=deleteOptionAction.bind(null,id,option.id);
            return <div key={option.id} style={{display:"grid",gap:10,padding:"16px 0"}}>
              <form action={update} className="field-grid">
                <label className="field"><span>Option name</span><input name="name" required defaultValue={option.name}/></label>
                <label className="field"><span>Values</span><input name="values" required defaultValue={option.values.map(value=>value.value).join(", ")}/></label>
                <label className="field"><span>Position</span><input name="position" type="number" min="0" defaultValue={index}/></label>
                <label className="field"><span>Visual option</span><input name="isVisual" type="checkbox" defaultChecked={option.isVisual}/></label>
                <div className="page-actions"><button className="secondary-button" type="submit">Save option</button></div>
              </form>
              <form action={remove}><button className="secondary-button" type="submit">Delete option</button></form>
            </div>;
          })}
        </div>
      </section>
    </article>}

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
          <h2>Generate variant matrix</h2>
          <p>Create every missing option combination automatically. Existing combinations are preserved.</p>
          {options.length?<form action={generate} className="field-grid">
            <label className="field"><span>Base SKU</span><input name="baseSku" defaultValue={product.sku==="—"?"":product.sku.split("-DEFAULT")[0]} placeholder="CEL"/></label>
            <label className="field"><span>Default price (PKR)</span><input name="price" type="number" min="0" required defaultValue={product.price}/></label>
            <label className="field"><span>Opening stock / variant</span><input name="inventory" type="number" min="0" defaultValue="0"/></label>
            <div className="page-actions"><button className="primary-button" type="submit">Generate missing variants</button></div>
          </form>:<p>Add options first.</p>}
        </section>
      </article>
    </section>

    <article className="panel settings-panel" style={{marginTop:14}}>
      <section className="settings-section">
        <h2>Add exact variant</h2>
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

    {variants.length>0&&<article className="panel settings-panel" style={{marginTop:14}}>
      <section className="settings-section">
        <h2>Variant operations</h2>
        <p>Edit sellable state or make audited inventory adjustments. Inventory changes are recorded separately from order sales.</p>
        <div className="seo-check-list">
          {variants.map(variant=>{
            const update=updateVariantAction.bind(null,id,variant.id);
            const adjust=adjustInventoryAction.bind(null,id,variant.id);
            const archive=archiveVariantAction.bind(null,id,variant.id);
            return <div key={variant.id} style={{display:"grid",gap:10,padding:"16px 0"}}>
              <form action={update} className="field-grid">
                <label className="field"><span>SKU</span><input name="sku" defaultValue={variant.sku}/></label>
                <label className="field"><span>Price</span><input name="price" type="number" min="0" defaultValue={variant.price}/></label>
                <label className="field"><span>Current stock</span><input type="number" value={variant.inventory} readOnly aria-readonly="true"/></label>
                <label className="field"><span>Status</span><select name="status" defaultValue={variant.status}><option value="active">Active</option><option value="draft">Draft</option></select></label>
                <label className="field"><span>Media set</span><select name="mediaSetId" defaultValue={variant.mediaSetId||""}><option value="">None / auto</option>{mediaSets.map(set=><option key={set.id} value={set.id}>{set.name}</option>)}</select></label>
                <div className="page-actions"><button className="secondary-button" type="submit">Save variant</button></div>
              </form>
              <form action={adjust} className="field-grid">
                <label className="field"><span>Inventory delta</span><input name="delta" type="number" required placeholder="+5 or -2"/></label>
                <label className="field"><span>Reason</span><input name="reason" required placeholder="Stock received / damaged / correction"/></label>
                <div className="page-actions"><button className="secondary-button" type="submit">Adjust stock</button></div>
              </form>
              <form action={saveVariantCostAction.bind(null,id,variant.id)} className="field-grid">
                <label className="field"><span>Unit cost / COGS</span><input name="costAmount" type="number" min="0" step=".01" defaultValue={variant.costAmount||0}/></label>
                <label className="field"><span>Variant weight (g)</span><input name="weightGrams" type="number" min="0" step=".001" defaultValue={variant.weightGrams??""}/></label>
                <div className="page-actions"><button className="secondary-button" type="submit">Save cost & weight</button></div>
              </form>
              <form action={archive}><button className="secondary-button" type="submit">Archive variant</button></form>
            </div>;
          })}
        </div>
      </section>
    </article>}

    {visualOptions.length>0&&<article className="panel settings-panel" style={{marginTop:14}}>
      <section className="settings-section">
        <h2>Create visual media set</h2>
        <p>Map a gallery to visual choices only. Non-visual options such as size share the same images.</p>
        <form action={addMediaSet} className="field-grid">
          <label className="field"><span>Set name</span><input name="name" required placeholder="Yellow Gold + Diamond"/></label>
          {visualOptions.map(option=><label className="field" key={option.id}><span>{option.name}</span><select name={"visual__"+option.name}>{option.values.map(value=><option key={value.id} value={value.value}>{value.value}</option>)}</select></label>)}
          <label className="field"><span>Default set</span><input name="isDefault" type="checkbox"/></label>
          <div className="page-actions"><button className="primary-button" type="submit">Create media set</button></div>
        </form>
      </section>
    </article>}


    <article className="panel settings-panel" style={{marginTop:14}}>
      <section className="settings-section">
        <h2>Media library</h2>
        <p>Upload a single master directly to managed object storage when Cloudflare R2 is configured, or attach an HTTPS source image. Alt text, focal point, role, ordering and variant media-set assignment remain editable.</p>
        <div className="settings-grid">
          <div>
            <h3>Managed master upload</h3>
            <ManagedMediaUpload productId={id} mediaSets={mediaSets}/>
          </div>
          <form action={addSourceMedia} className="field-grid">
            <label className="field" style={{gridColumn:"1 / -1"}}><span>HTTPS source image</span><input name="sourceUrl" type="url" placeholder="https://..." required/></label>
            <label className="field"><span>Alt text</span><input name="altText"/></label>
            <label className="field"><span>Role</span><select name="role"><option value="gallery">Gallery</option><option value="primary">Primary</option></select></label>
            <label className="field"><span>Position</span><input name="position" type="number" min="0" defaultValue={media.length}/></label>
            <label className="field"><span>Media set</span><select name="mediaSetId"><option value="">None / default</option>{mediaSets.map(set=><option key={set.id} value={set.id}>{set.name}</option>)}</select></label>
            <button className="secondary-button" type="submit">Attach source image</button>
          </form>
        </div>
        <div className="seo-check-list" style={{marginTop:18}}>
          {media.map((item:any)=>{
            const update=updateMediaAction.bind(null,id,item.id);
            const remove=deleteMediaAction.bind(null,id,item.id);
            const imageUrl=item.responsive?.card_desktop||item.url||item.sourceUrl;
            return <div key={item.id} style={{display:"grid",gridTemplateColumns:"96px 1fr",gap:16,padding:"16px 0"}}>
              <div style={{width:96,height:96,borderRadius:12,overflow:"hidden",background:"var(--surface-2)"}}>{imageUrl&&<img src={imageUrl} alt={item.altText||""} style={{width:"100%",height:"100%",objectFit:"cover"}}/>}</div>
              <div style={{display:"grid",gap:10}}>
                <form action={update} className="field-grid">
                  <label className="field"><span>Alt text</span><input name="altText" defaultValue={item.altText||""}/></label>
                  <label className="field"><span>Role</span><select name="role" defaultValue={item.role||"gallery"}><option value="primary">Primary</option><option value="gallery">Gallery</option></select></label>
                  <label className="field"><span>Position</span><input name="position" type="number" min="0" defaultValue={item.position||0}/></label>
                  <label className="field"><span>Media set</span><select name="mediaSetId" defaultValue={item.mediaSetId||""}><option value="">None</option>{mediaSets.map(set=><option key={set.id} value={set.id}>{set.name}</option>)}</select></label>
                  <label className="field"><span>Focal X</span><input name="focalX" type="number" min="0" max="1" step=".01" defaultValue={item.focalX??.5}/></label>
                  <label className="field"><span>Focal Y</span><input name="focalY" type="number" min="0" max="1" step=".01" defaultValue={item.focalY??.5}/></label>
                  <button className="secondary-button" type="submit">Save media</button>
                </form>
                <form action={remove}><button className="secondary-button" type="submit">Delete media</button></form>
              </div>
            </div>;
          })}
          {!media.length&&<p>No media attached yet.</p>}
        </div>
      </section>
    </article>

    <article className="panel settings-panel" style={{marginTop:14}}>
      <section className="settings-section">
        <h2>Search presentation</h2>
        <p>These values are stored in Supabase and returned with the Storefront API product.</p>
        <form action={saveSeo} className="field-grid">
          <label className="field"><span>SEO title</span><input name="title" defaultValue={seo?.title||product.name+" | Jewelry Store"}/></label>
          <label className="field"><span>Canonical path</span><input name="canonicalPath" defaultValue={seo?.canonical_path||("/product/"+(product.handle||""))}/></label>
          <label className="field" style={{gridColumn:"1 / -1"}}><span>Meta description</span><textarea name="metaDescription" rows={4} defaultValue={seo?.meta_description||product.description||""}/></label>
          <label className="field"><span>Index in search</span><input name="index" type="checkbox" defaultChecked={seo?.robots_index!==false}/></label>
          <div className="page-actions"><button className="primary-button" type="submit">Save SEO</button></div>
        </form>
      </section>
    </article>

  </>;
}
