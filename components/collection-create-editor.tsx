"use client";

import {useMemo,useState} from "react";
import {RichTextEditor} from "@/components/rich-text-editor";
import {createCollectionAction} from "@/app/collections/actions";

type Product={id:string;name:string;sku:string;status:string;category?:string};

const slugify=(value:string)=>value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");

export function CollectionCreateEditor({products}:{products:Product[]}){
  const [title,setTitle]=useState("");
  const [handle,setHandle]=useState("");
  const [handleTouched,setHandleTouched]=useState(false);
  const [collectionType,setCollectionType]=useState<"manual"|"smart">("manual");
  const [ruleCount,setRuleCount]=useState(1);
  const [search,setSearch]=useState("");
  const [selected,setSelected]=useState<string[]>([]);

  const visibleProducts=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return (q?products.filter(p=>(p.name+" "+p.sku+" "+(p.category||"")).toLowerCase().includes(q)):products).slice(0,40);
  },[products,search]);

  const onTitle=(value:string)=>{
    setTitle(value);
    if(!handleTouched) setHandle(slugify(value));
  };

  return <form action={createCollectionAction} className="shopify-collection-layout">
    <div className="shopify-collection-main">
      <section className="shopify-admin-card">
        <label className="shopify-admin-field">
          <span>Title</span>
          <input name="title" required value={title} onChange={e=>onTitle(e.target.value)} placeholder="Summer jewelry"/>
        </label>
        <div className="shopify-admin-field">
          <span>Description</span>
          <RichTextEditor name="description" placeholder="Tell shoppers what makes this collection special…"/>
        </div>
      </section>

      <section className="shopify-admin-card">
        <div className="shopify-card-heading">
          <div><h2>Collection type</h2><p>Choose how products are added to this collection.</p></div>
        </div>
        <div className="collection-type-choice">
          <label className={collectionType==="manual"?"active":""}>
            <input type="radio" name="collectionType" value="manual" checked={collectionType==="manual"} onChange={()=>setCollectionType("manual")}/>
            <span><b>Manual</b><small>Select the products you want to include.</small></span>
          </label>
          <label className={collectionType==="smart"?"active":""}>
            <input type="radio" name="collectionType" value="smart" checked={collectionType==="smart"} onChange={()=>setCollectionType("smart")}/>
            <span><b>Smart</b><small>Automatically include products that match conditions.</small></span>
          </label>
        </div>

        {collectionType==="manual"?<div className="collection-products-picker">
          <div className="collection-picker-toolbar">
            <div className="shopify-search"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products"/></div>
            <span>{selected.length} selected</span>
          </div>
          <div className="collection-product-list">
            {visibleProducts.map(product=><label key={product.id}>
              <input type="checkbox" name="productIds" value={product.id} checked={selected.includes(product.id)} onChange={e=>setSelected(current=>e.target.checked?[...current,product.id]:current.filter(id=>id!==product.id))}/>
              <span className="collection-product-thumb">◇</span>
              <span><b>{product.name}</b><small>{product.sku} · {product.category||"Jewelry"}</small></span>
              <em>{product.status}</em>
            </label>)}
            {!visibleProducts.length&&<div className="catalog-empty small"><b>No products found</b><span>Try another search.</span></div>}
          </div>
        </div>:<div className="smart-conditions">
          <div className="smart-condition-head">
            <span>Products must match</span>
            <select name="matchType" defaultValue="all"><option value="all">all conditions</option><option value="any">any condition</option></select>
          </div>
          {Array.from({length:ruleCount}).map((_,i)=><div className="smart-condition-row" key={i}>
            <select name={"ruleField_"+i} defaultValue="category">
              <option value="category">Product category</option>
              <option value="product_type">Product type</option>
              <option value="vendor">Vendor</option>
              <option value="tag">Tag</option>
              <option value="material">Material</option>
              <option value="status">Status</option>
              <option value={"metafield:custom.stone_type"}>Metafield: stone type</option>
              <option value={"metafield:custom.karat"}>Metafield: karat</option>
            </select>
            <select name={"ruleOperator_"+i}><option value="equals">is equal to</option><option value="not_equals">is not equal to</option><option value="contains">contains</option></select>
            <input name={"ruleValue_"+i} placeholder="Value"/>
            {ruleCount>1&&<button type="button" onClick={()=>setRuleCount(count=>Math.max(1,count-1))}>×</button>}
          </div>)}
          {ruleCount<8&&<button className="text-action" type="button" onClick={()=>setRuleCount(count=>count+1)}>+ Add another condition</button>}
        </div>}
      </section>

      <section className="shopify-admin-card">
        <div className="shopify-card-heading">
          <div><h2>Search engine listing</h2><p>Preview how this collection can appear in search results.</p></div>
        </div>
        <div className="seo-preview-card">
          <span className="seo-preview-url">https://store.example/collections/{handle||"collection-handle"}</span>
          <b>{title||"Collection title"}</b>
          <p>Customize the title and description below for search engines.</p>
        </div>
        <div className="shopify-admin-field-grid">
          <label className="shopify-admin-field"><span>Page title</span><input name="seoTitle" placeholder={title||"Collection title"}/></label>
          <label className="shopify-admin-field"><span>URL handle</span><div className="handle-input"><i>/collections/</i><input name="handle" required value={handle} onChange={e=>{setHandleTouched(true);setHandle(slugify(e.target.value));}}/></div></label>
        </div>
        <label className="shopify-admin-field"><span>Meta description</span><textarea name="metaDescription" rows={3} placeholder="Describe this collection for search results"/></label>
      </section>
    </div>

    <aside className="shopify-collection-side">
      <section className="shopify-admin-card">
        <div className="shopify-card-heading"><h2>Publishing</h2></div>
        <label className="shopify-admin-field"><span>Status</span><select name="status" defaultValue="active"><option value="active">Active</option><option value="draft">Draft</option></select></label>
        <label className="shopify-admin-check"><input type="checkbox" defaultChecked disabled/><span><b>Online storefront</b><small>Available through the headless storefront when active.</small></span></label>
        <label className="shopify-admin-field"><span>Publish date</span><input name="publishAt" type="datetime-local"/></label>
      </section>

      <section className="shopify-admin-card">
        <div className="shopify-card-heading"><h2>Collection image</h2></div>
        <div className="collection-image-placeholder"><span>▧</span><b>Add collection image</b><small>Paste an image URL now; direct upload can use the media pipeline later.</small></div>
        <label className="shopify-admin-field"><span>Image URL</span><input name="imageUrl" type="url" placeholder="https://…"/></label>
      </section>

      <section className="shopify-admin-card">
        <div className="shopify-card-heading"><h2>Sorting</h2></div>
        <label className="shopify-admin-field"><span>Default sort</span><select name="merchandisingSort" defaultValue="manual"><option value="manual">Manually</option><option value="title">Alphabetically</option><option value="newest">Newest first</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></select></label>
        <input type="hidden" name="position" value="0"/>
      </section>

      <div className="shopify-save-bar">
        <button className="primary-button wide-button" type="submit">Save collection</button>
      </div>
    </aside>
  </form>;
}
