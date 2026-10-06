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
          <label className="field"><span>Collection type</span><select name="collectionType" defaultValue="manual"><option value="manual">Manual / curated</option><option value="smart">Smart / rule-based</option></select></label>
          <label className="field"><span>Rule matching</span><select name="matchType" defaultValue="all"><option value="all">Match all rules</option><option value="any">Match any rule</option></select></label>
          <label className="field"><span>Publish at</span><input name="publishAt" type="datetime-local"/></label>
          <label className="field"><span>Unpublish at</span><input name="unpublishAt" type="datetime-local"/></label>
          <label className="field"><span>Hero image URL</span><input name="imageUrl" placeholder="https://..."/></label>
          <label className="field" style={{gridColumn:"1 / -1"}}><span>Description</span><textarea name="description" rows={6}/></label>
          <label className="field"><span>Merchandising sort</span><select name="merchandisingSort"><option value="manual">Manual</option><option value="title">Title</option><option value="newest">Newest</option><option value="price_asc">Price low-high</option><option value="price_desc">Price high-low</option></select></label>
        </div>
        <h3>Smart rules</h3>
        <p>Used only when Collection type is Smart. For metafields use field format <code>metafield:custom.stone_type</code>.</p>
        <div className="seo-check-list">
          {Array.from({length:5}).map((_,i)=><div className="field-grid" key={i}><label className="field"><span>Field</span><input name={"ruleField_"+i} placeholder="category or metafield:custom.stone_type"/></label><label className="field"><span>Operator</span><select name={"ruleOperator_"+i}><option value="equals">Equals</option><option value="not_equals">Not equals</option><option value="contains">Contains</option></select></label><label className="field"><span>Value</span><input name={"ruleValue_"+i}/></label></div>)}
        </div>
        <div className="field-grid">
        </div>
      </section>
      <div className="page-actions"><button className="primary-button" type="submit">Create collection</button></div>
    </form>
  </>;
}
