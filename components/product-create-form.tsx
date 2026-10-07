"use client";
import Link from "next/link";
import {useState} from "react";
import {RichTextEditor} from "@/components/rich-text-editor";
import {createProductAction} from "@/app/products/actions";

const slugify=(s:string)=>s.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");

export function ProductCreateForm(){
  const [title,setTitle]=useState("");
  const [handle,setHandle]=useState("");
  const [handleTouched,setHandleTouched]=useState(false);
  const titleChanged=(v:string)=>{setTitle(v);if(!handleTouched)setHandle(slugify(v));};
  return <form action={createProductAction} className="shopify-form-shell product-create-shell">
    <div className="shopify-form-main">
      <section className="shop-card">
        <div className="shop-field-stack">
          <label><span>Title</span><input name="title" value={title} onChange={e=>titleChanged(e.target.value)} required placeholder="Diamond halo ring"/></label>
          <div><span className="shop-label">Description</span><RichTextEditor name="description" placeholder="Describe the product, materials, care and story…"/></div>
        </div>
      </section>

      <section className="shop-card">
        <div className="shop-card-head"><div><h2>Media</h2><p>Images and media can be attached immediately after the first save.</p></div></div>
        <div className="media-drop-placeholder"><div>＋</div><b>Add product media after save</b><span>The product page opens after creation so you can upload, reorder and map images to variants.</span></div>
      </section>

      <section className="shop-card">
        <div className="shop-card-head"><h2>Pricing</h2></div>
        <div className="shop-3col">
          <label><span>Price</span><div className="money-input"><i>Rs.</i><input name="price" type="number" min="0" defaultValue="0"/></div></label>
          <label><span>Cost per item</span><div className="money-input"><i>Rs.</i><input name="costPrice" type="number" min="0"/></div></label>
          <label className="shop-check-row"><input name="taxable" type="checkbox" defaultChecked/><span>Charge tax on this product</span></label>
        </div>
      </section>

      <section className="shop-card">
        <div className="shop-card-head"><h2>Inventory</h2></div>
        <div className="shop-2col">
          <label><span>SKU</span><input name="sku" placeholder="JS-RING-001"/></label>
          <label><span>Opening stock</span><input name="inventory" type="number" min="0" defaultValue="0"/></label>
        </div>
      </section>

      <section className="shop-card">
        <div className="shop-card-head"><h2>Shipping</h2></div>
        <div className="shop-2col">
          <label><span>Product weight (g)</span><input name="weightGrams" type="number" min="0"/></label>
          <label><span>Variant weight (g)</span><input name="variantWeightGrams" type="number" min="0"/></label>
        </div>
      </section>

      <section className="shop-card">
        <div className="shop-card-head"><div><h2>Search engine listing</h2><p>Set a clean URL handle. SEO title and description can be refined after save.</p></div></div>
        <label><span>URL handle</span><div className="handle-input"><i>/product/</i><input name="handle" value={handle} onChange={e=>{setHandleTouched(true);setHandle(slugify(e.target.value));}} required placeholder="product-handle"/></div></label>
      </section>
    </div>

    <aside className="shopify-form-side">
      <section className="shop-card"><div className="shop-card-head"><h2>Status</h2></div><select name="status" defaultValue="draft"><option value="draft">Draft</option><option value="active">Active</option></select></section>
      <section className="shop-card"><div className="shop-card-head"><h2>Publishing</h2></div><div className="shop-field-stack"><label><span>Publish at</span><input name="publishedAt" type="datetime-local"/></label><label className="shop-check-row"><input name="featured" type="checkbox"/><span>Feature on storefront</span></label></div></section>
      <section className="shop-card"><div className="shop-card-head"><h2>Product organization</h2></div><div className="shop-field-stack"><label><span>Product type</span><input name="productType" placeholder="Ring"/></label><label><span>Vendor</span><input name="vendor" placeholder="Jewelry Store"/></label><label><span>Category</span><input name="category" placeholder="Rings"/></label><label><span>Tags</span><input name="tags" placeholder="bridal, gold, diamond"/></label></div></section>
      <section className="shop-card"><div className="shop-card-head"><h2>Jewelry details</h2></div><div className="shop-field-stack"><label><span>Material</span><input name="material" placeholder="18K Gold · Diamond"/></label><label><span>Badge / legacy tag</span><input name="tag" placeholder="Heirloom"/></label></div></section>
      <div className="shop-save-actions"><Link className="secondary-button" href="/products">Cancel</Link><button className="primary-button" type="submit">Save product</button></div>
    </aside>
  </form>;
}
