import Link from "next/link";
import {PageHeader} from "@/components/page-header";
import {RichTextEditor} from "@/components/rich-text-editor";
import {createProductAction} from "../actions";

export default function NewProductPage(){
  return <>
    <PageHeader eyebrow="CATALOG / NEW" title="Create product" description="Create the canonical product first. Options, variants, media, SEO and channel overlays attach to this identity.">
      <Link className="secondary-button" href="/products">Cancel</Link>
    </PageHeader>

    <form action={createProductAction} className="panel settings-panel">
      <section className="settings-section">
        <h2>Core identity</h2>
        <p>This data becomes the source of truth for the storefront and future channels.</p>
        <div className="field-grid">
          <label className="field"><span>Product title</span><input name="title" required placeholder="Celestia Ring"/></label>
          <label className="field"><span>Handle</span><input name="handle" required placeholder="celestia-ring"/></label>
          <label className="field"><span>SKU</span><input name="sku" placeholder="JS-CEL"/></label>
          <label className="field"><span>Status</span><select name="status" defaultValue="draft"><option value="draft">Draft</option><option value="active">Active</option></select></label>
          <label className="field"><span>Category</span><input name="category" placeholder="Rings"/></label>
          <label className="field"><span>Material</span><input name="material" placeholder="18K Gold · Diamond"/></label>
          <label className="field"><span>Tag</span><input name="tag" placeholder="Heirloom"/></label>
          <label className="field"><span>Starting price (PKR)</span><input name="price" type="number" min="0" defaultValue="0"/></label>
          <label className="field"><span>Opening stock</span><input name="inventory" type="number" min="0" defaultValue="0"/></label>
          <label className="field"><span>Featured</span><input name="featured" type="checkbox"/></label>
          <div className="field" style={{gridColumn:"1 / -1"}}><span>Description / story</span><RichTextEditor name="description"/></div>
        </div>
      </section>
      <div className="page-actions"><button className="primary-button" type="submit">Create product</button></div>
    </form>
  </>;
}
