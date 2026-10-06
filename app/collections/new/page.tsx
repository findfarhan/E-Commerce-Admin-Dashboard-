import Link from "next/link";
import {PageHeader} from "@/components/page-header";
import {createCollectionAction} from "../actions";

export default function NewCollectionPage(){
  return <>
    <PageHeader eyebrow="MERCHANDISING / NEW" title="Create collection" description="Collections remain curated resources rather than uncontrolled filter pages.">
      <Link className="secondary-button" href="/collections">Cancel</Link>
    </PageHeader>
    <form action={createCollectionAction} className="panel settings-panel">
      <section className="settings-section">
        <h2>Collection identity</h2>
        <div className="field-grid">
          <label className="field"><span>Title</span><input name="title" required placeholder="Gemstone"/></label>
          <label className="field"><span>Handle</span><input name="handle" required placeholder="gemstone"/></label>
          <label className="field"><span>Subtitle</span><input name="subtitle" placeholder="Color as a personal signal"/></label>
          <label className="field"><span>Status</span><select name="status" defaultValue="active"><option value="active">Active</option><option value="draft">Draft</option></select></label>
          <label className="field"><span>Position</span><input name="position" type="number" min="0" defaultValue="0"/></label>
          <label className="field"><span>Hero image URL</span><input name="imageUrl" placeholder="https://..."/></label>
          <label className="field" style={{gridColumn:"1 / -1"}}><span>Description</span><textarea name="description" rows={6}/></label>
        </div>
      </section>
      <div className="page-actions"><button className="primary-button" type="submit">Create collection</button></div>
    </form>
  </>;
}
