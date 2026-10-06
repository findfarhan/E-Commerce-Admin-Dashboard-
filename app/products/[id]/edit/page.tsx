import Link from "next/link";
import {notFound} from "next/navigation";
import {PageHeader} from "@/components/page-header";
import {getAdminProductDetail} from "@/lib/admin-api";
import {updateProductAction} from "../../actions";

export default async function EditProductPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const detail=await getAdminProductDetail(id);
  if(!detail) notFound();
  const product:any=detail.product;
  const action=updateProductAction.bind(null,id);

  return <>
    <PageHeader eyebrow="CATALOG / EDIT" title={product.name} description="Update canonical product content without changing its product identity.">
      <Link className="secondary-button" href={"/products/"+id}>Cancel</Link>
    </PageHeader>

    <form action={action} className="panel settings-panel">
      <section className="settings-section">
        <h2>Core identity</h2>
        <div className="field-grid">
          <label className="field"><span>Product title</span><input name="title" required defaultValue={product.name}/></label>
          <label className="field"><span>Handle</span><input name="handle" required defaultValue={(product as any).handle||""}/></label>
          <label className="field"><span>Status</span><select name="status" defaultValue={product.status}><option value="draft">Draft</option><option value="active">Active</option></select></label>
          <label className="field"><span>Category</span><input name="category" defaultValue={(product as any).category||""}/></label>
          <label className="field"><span>Material</span><input name="material" defaultValue={(product as any).material||""}/></label>
          <label className="field"><span>Tag</span><input name="tag" defaultValue={(product as any).tag||""}/></label>
          <label className="field"><span>Featured</span><input name="featured" type="checkbox" defaultChecked={Boolean((product as any).featured)}/></label>
          <label className="field" style={{gridColumn:"1 / -1"}}><span>Description / story</span><textarea name="description" rows={7} defaultValue={(product as any).description||""}/></label>
        </div>
      </section>
      <div className="page-actions"><button className="primary-button" type="submit">Save product</button></div>
    </form>
  </>;
}
