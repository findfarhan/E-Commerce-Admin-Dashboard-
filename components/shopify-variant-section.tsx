"use client";

import type {ProductMediaSet,ProductOption,ProductVariant} from "@/lib/types";
import {
  archiveVariantAction,
  createOptionAction,
  createVariantAction,
  deleteOptionAction,
  generateVariantsAction,
  updateOptionAction,
  updateVariantAction,
} from "@/app/products/actions";

export function ShopifyVariantSection({
  productId,
  productSku,
  productPrice,
  options,
  variants,
  mediaSets,
}:{
  productId:string;
  productSku:string;
  productPrice:number;
  options:ProductOption[];
  variants:ProductVariant[];
  mediaSets:ProductMediaSet[];
}){
  const addOption=createOptionAction.bind(null,productId);
  const generate=generateVariantsAction.bind(null,productId);
  const addVariant=createVariantAction.bind(null,productId);

  return <section className="shopify-variant-card">
    <div className="shopify-variant-head">
      <div><h2>Variants</h2><p>Add options such as metal, stone or size, then manage each sellable combination.</p></div>
      <span>{variants.length} variant{variants.length===1?"":"s"}</span>
    </div>

    <div className="shopify-options-area">
      {options.map((option,index)=>{
        const update=updateOptionAction.bind(null,productId,option.id);
        const remove=deleteOptionAction.bind(null,productId,option.id);
        return <details className="shopify-option-row" key={option.id}>
          <summary>
            <span className="option-drag">⋮⋮</span>
            <span className="option-summary-copy"><b>{option.name}</b><small>{option.values.map(value=>value.value).join(", ")}</small></span>
            <span className="option-edit-label">Edit</span>
          </summary>
          <div className="option-edit-panel">
            <form action={update}>
              <div className="shopify-admin-field-grid">
                <label className="shopify-admin-field"><span>Option name</span><input name="name" required defaultValue={option.name}/></label>
                <label className="shopify-admin-field"><span>Values</span><input name="values" required defaultValue={option.values.map(value=>value.value).join(", ")}/></label>
              </div>
              <div className="option-edit-actions">
                <input type="hidden" name="position" value={index}/>
                <label className="shopify-admin-check compact"><input name="isVisual" type="checkbox" defaultChecked={option.isVisual}/><span><b>Visual option</b><small>Can control variant imagery.</small></span></label>
                <button className="secondary-button">Save option</button>
              </div>
            </form>
            <form action={remove}><button className="text-danger" type="submit">Delete option</button></form>
          </div>
        </details>;
      })}

      {options.length<3&&<details className="add-option-panel">
        <summary>+ Add another option</summary>
        <form action={addOption}>
          <div className="shopify-admin-field-grid">
            <label className="shopify-admin-field"><span>Option name</span><input name="name" required placeholder="Size"/></label>
            <label className="shopify-admin-field"><span>Option values</span><input name="values" required placeholder="6, 7, 8, 9"/></label>
          </div>
          <input type="hidden" name="position" value={options.length}/>
          <label className="shopify-admin-check compact"><input name="isVisual" type="checkbox"/><span><b>Visual option</b><small>Enable for metal/stone/color, not usually size.</small></span></label>
          <button className="primary-button">Add option</button>
        </form>
      </details>}
    </div>

    {options.length>0&&<div className="variant-generation-bar">
      <div><b>Generate combinations</b><span>Create any missing combinations from the option values above.</span></div>
      <form action={generate}>
        <input name="baseSku" defaultValue={productSku==="—"?"":productSku.split("-DEFAULT")[0]} placeholder="SKU prefix"/>
        <input name="price" type="number" min="0" defaultValue={productPrice}/>
        <input name="inventory" type="number" min="0" defaultValue="0"/>
        <button className="secondary-button">Generate missing variants</button>
      </form>
    </div>}

    <div className="shopify-variant-toolbar">
      <div><b>Variant list</b><span>Price, available stock and SKU are managed per variant.</span></div>
      {options.length>0&&<details className="add-variant-popover">
        <summary className="secondary-button">Add variant</summary>
        <form action={addVariant} className="variant-create-form">
          {options.map(option=><label className="shopify-admin-field" key={option.id}><span>{option.name}</span><select name={"option__"+option.name}>{option.values.map(value=><option key={value.id} value={value.value}>{value.value}</option>)}</select></label>)}
          <label className="shopify-admin-field"><span>SKU</span><input name="sku" required/></label>
          <label className="shopify-admin-field"><span>Price</span><input name="price" type="number" min="0" required/></label>
          <label className="shopify-admin-field"><span>Inventory</span><input name="inventory" type="number" min="0" defaultValue="0"/></label>
          <label className="shopify-admin-field"><span>Status</span><select name="status" defaultValue="active"><option value="active">Active</option><option value="draft">Draft</option></select></label>
          <button className="primary-button">Create variant</button>
        </form>
      </details>}
    </div>

    <div className="shopify-variant-table-wrap">
      <table className="shopify-variant-table">
        <thead><tr><th></th><th>Variant</th><th>Price</th><th>Available</th><th>SKU</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {variants.map(variant=>{
            const update=updateVariantAction.bind(null,productId,variant.id);
            const archive=archiveVariantAction.bind(null,productId,variant.id);
            return <tr key={variant.id}>
              <td><span className="variant-thumb">◇</span></td>
              <td><div className="variant-title-cell"><b>{variant.title||Object.values(variant.selectedOptions).join(" / ")}</b><small>{Object.entries(variant.selectedOptions).map(([key,value])=>key+": "+value).join(" · ")}</small></div></td>
              <td>Rs. {variant.price.toLocaleString("en-PK")}</td>
              <td>{variant.inventory}</td>
              <td>{variant.sku}</td>
              <td><span className={"status-pill "+(variant.status==="active"?"success":"neutral")}>{variant.status}</span></td>
              <td className="right">
                <details className="variant-edit-popover">
                  <summary>•••</summary>
                  <div>
                    <form action={update}>
                      <label><span>Price</span><input name="price" type="number" min="0" defaultValue={variant.price}/></label>
                      <label><span>SKU</span><input name="sku" defaultValue={variant.sku}/></label>
                      <label><span>Cost per item</span><input name="costPrice" type="number" min="0" defaultValue={variant.costPrice??""}/></label>
                      <label><span>Weight (g)</span><input name="weightGrams" type="number" min="0" defaultValue={variant.weightGrams??""}/></label>
                      <label><span>Status</span><select name="status" defaultValue={variant.status}><option value="active">Active</option><option value="draft">Draft</option></select></label>
                      <label><span>Media set</span><select name="mediaSetId" defaultValue={variant.mediaSetId||""}><option value="">Automatic</option>{mediaSets.map(set=><option key={set.id} value={set.id}>{set.name}</option>)}</select></label>
                      <button className="primary-button">Save</button>
                    </form>
                    <form action={archive}><button className="text-danger">Archive variant</button></form>
                  </div>
                </details>
              </td>
            </tr>;
          })}
          {!variants.length&&<tr><td colSpan={7}><div className="catalog-empty small"><b>No variants yet</b><span>Add options, then generate combinations or create a variant.</span></div></td></tr>}
        </tbody>
      </table>
    </div>
  </section>;
}
