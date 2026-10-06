"use client";

import {useMemo,useState} from "react";
import {authorityMentions,entityFacts,mediaSeoItems,seoPillars,seoWorkItems,voiceQueryTargets} from "@/lib/mock-data";

type View="overview"|"core"|"ai"|"authority"|"commerce"|"media"|"local"|"app"|"policy";

export function SeoOperatingSystem(){
  const [view,setView]=useState<View>("overview");
  const active=seoPillars.filter(x=>x.score!==null);
  const overall=useMemo(()=>Math.round(active.reduce((a,b)=>a+(b.score??0),0)/active.length),[]);

  return <>
    <nav className="seo-os-tabs">
      {([["overview","Overview"],["core","Core + technical"],["ai","AI / GEO"],["authority","Authority"],["commerce","E-commerce"],["media","Visual / voice"],["local","Local"],["app","ASO"],["policy","Policy"]] as [View,string][]).map(([key,label])=><button key={key} className={view===key?"active":""} onClick={()=>setView(key)}>{label}</button>)}
    </nav>

    {view==="overview"&&<>
      <section className="seo-os-score-grid">
        <article className="panel seo-os-score hero-score"><span>DISCOVERY HEALTH</span><strong>{overall}</strong><small>Search + AI + commerce + authority</small><div><i style={{width:overall+"%"}}/></div></article>
        <article className="panel seo-os-score"><span>OPEN TASKS</span><strong>{seoWorkItems.filter(x=>x.status!=="done").length}</strong><small>Prioritized work queue</small></article>
        <article className="panel seo-os-score"><span>ENTITY FACTS</span><strong>{entityFacts.filter(x=>x.verified).length}/{entityFacts.length}</strong><small>Verified brand facts</small></article>
        <article className="panel seo-os-score"><span>AUTHORITY</span><strong>{authorityMentions.length}</strong><small>Mentions / opportunities</small></article>
      </section>
      <section className="seo-pillar-grid">{seoPillars.map(item=><article className="panel seo-pillar-card" key={item.key}><div className="seo-pillar-top"><span>{item.name}</span><em className={"seo-pillar-state "+item.status}>{item.status.replace("_"," ")}</em></div><strong>{item.score??"—"}</strong><p>{item.description}</p><div className="seo-pillar-metric"><small>CURRENT</small><b>{item.primaryMetric}</b></div><div className="seo-pillar-next"><small>NEXT</small><span>{item.nextAction}</span></div></article>)}</section>
      <article className="panel seo-priority-panel"><div className="panel-head"><div><span>WORK QUEUE</span><h2>Priority SEO actions</h2></div><span className="seo-pill-muted">WHITE-HAT ONLY</span></div>{seoWorkItems.map(task=><div className="seo-priority-row" key={task.id}><span className={"seo-task-priority "+task.priority}>{task.priority}</span><div><b>{task.title}</b><p>{task.reason}</p></div><small>{task.owner}</small><span className={"seo-task-status "+task.status}>{task.status.replace("_"," ")}</span></div>)}</article>
    </>}

    {view==="core"&&<section className="seo-os-two-col">
      <article className="panel seo-deep-card"><div className="panel-head"><div><span>TECHNICAL SEO</span><h2>Crawl and index health</h2></div><div className="seo-health-dot healthy">92</div></div><div className="seo-check-list">{[["HTTPS / SSL","Pass","Vercel"],["Mobile viewport","Pass","Responsive UI"],["XML sitemap","Pass","Generated"],["robots.txt","Pass","Generated"],["Canonical URLs","Pass","Metadata"],["Product schema","Pass","JSON-LD"],["Core Web Vitals","Pending","Audit connector"]].map(([name,status,source])=><div key={name}><span>{name}</span><b>{status}</b><em>{source}</em></div>)}</div></article>
      <article className="panel seo-deep-card"><div className="panel-head"><div><span>FACET RULES</span><h2>Filters without crawl traps</h2></div></div><div className="crawl-rule-grid"><div><span>Curated collections</span><b>Index</b></div><div><span>Material pages</span><b>Manual approval</b></div><div><span>Size filters</span><b>Noindex</b></div><div><span>Sort parameters</span><b>Noindex</b></div><div><span>Empty results</span><b>Noindex</b></div><div><span>Handle changes</span><b>301 registry</b></div></div></article>
    </section>}

    {view==="ai"&&<section className="seo-os-two-col">
      <article className="panel seo-deep-card"><div className="panel-head"><div><span>ENTITY FACTS</span><h2>What AI should know</h2></div></div><div className="entity-fact-list">{entityFacts.map(fact=><div key={fact.id}><span className={fact.verified?"verified":"unverified"}>{fact.verified?"verified":"review"}</span><b>{fact.field}</b><p>{fact.value}</p><small>{fact.source}</small></div>)}</div></article>
      <article className="panel seo-deep-card"><div className="panel-head"><div><span>GEO MODEL</span><h2>Citation-ready content</h2></div></div><div className="geo-principle-grid"><div><b>First-party facts</b><p>Stable About, care, materials and policy pages.</p></div><div><b>Structured identity</b><p>Organization, Product and Breadcrumb schema from canonical data.</p></div><div><b>External corroboration</b><p>Track genuine citations, profiles and brand mentions.</p></div></div></article>
    </section>}

    {view==="authority"&&<section className="seo-os-two-col">
      <article className="panel seo-deep-card wide"><div className="panel-head"><div><span>AUTHORITY GRAPH</span><h2>Mentions, backlinks and PR opportunities</h2></div></div><div className="authority-table">{authorityMentions.map(x=><div className="authority-row" key={x.id}><b>{x.source}</b><span>{x.type.replace("_"," ")}</span><span>{x.status.replace("_"," ")}</span><em className={"authority-quality "+x.quality}>{x.quality}</em><small>{x.discoveredAt}</small></div>)}</div></article>
      <article className="panel seo-deep-card"><div className="community-guardrail"><strong>Authentic community only.</strong><p>Track real Reddit, Quora and forum questions. Never automate fake identities, fake reviews, synthetic discussions or spam links.</p></div></article>
    </section>}

    {view==="commerce"&&<section className="seo-os-two-col"><article className="panel seo-deep-card"><div className="panel-head"><div><span>PRODUCT DISCOVERY</span><h2>E-commerce SEO</h2></div><div className="seo-health-dot healthy">93</div></div><div className="seo-check-list">{[["Unique product handles","8 / 8","Canonical"],["Variant SKUs","Ready","Catalog"],["Product / Offer schema","Ready","Website"],["Merchant taxonomy","Ready model","Google"],["Reviews schema","Conditional","Only real reviews"]].map(([a,b,c])=><div key={a}><span>{a}</span><b>{b}</b><em>{c}</em></div>)}</div></article></section>}

    {view==="media"&&<section className="seo-os-two-col">
      <article className="panel seo-deep-card wide"><div className="panel-head"><div><span>VISUAL SEARCH</span><h2>Image semantics + responsive delivery</h2></div></div><div className="media-seo-table">{mediaSeoItems.map(x=><div className="media-seo-row" key={x.id}><b>{x.resource}</b><span>{x.mediaType}</span><p>{x.altText??"Missing alt text"}</p><strong className={x.score<80?"danger-text":"positive-text"}>{x.score}%</strong></div>)}</div></article>
      <article className="panel seo-deep-card"><div className="panel-head"><div><span>VOICE SEARCH</span><h2>Conversational targets</h2></div></div><div className="voice-query-list">{voiceQueryTargets.map(x=><div key={x.id}><span className={x.covered?"covered":"gap"}>{x.covered?"covered":"gap"}</span><b>{x.query}</b><small>{x.answerResource}</small></div>)}</div></article>
    </section>}

    {view==="local"&&<article className="panel seo-deep-card"><div className="panel-head"><div><span>LOCAL SEO</span><h2>Dormant until a real eligible location exists</h2></div></div><div className="community-guardrail"><strong>No fake locations.</strong><p>GBP, NAP and local pages activate only when the business has a genuine public location or valid service-area setup.</p></div></article>}

    {view==="app"&&<article className="panel seo-deep-card"><div className="panel-head"><div><span>ASO</span><h2>Future mobile-app channel</h2></div></div><div className="seo-check-list"><div><span>Title / subtitle</span><b>Model ready</b><em>Future</em></div><div><span>Screenshots</span><b>R2-ready</b><em>Device sizes</em></div><div><span>Localization</span><b>Ready model</b><em>Future</em></div></div></article>}

    {view==="policy"&&<section className="policy-board">
      <article className="panel policy-card allowed"><span>DEFAULT</span><h2>White-hat</h2><p>Useful content, accurate structured data, earned links and real reviews.</p><ul><li>Earned editorial backlinks</li><li>Real customer review requests</li><li>Helpful disclosed community participation</li><li>Accurate product feeds</li></ul></article>
      <article className="panel policy-card blocked"><span>BLOCKED</span><h2>Black-hat</h2><p>Anything designed to deceive users, communities or search engines.</p><ul><li>Fake backlinks or link farms</li><li>Fake reviews or fake personas</li><li>Keyword stuffing</li><li>Location spam</li></ul></article>
      <article className="panel policy-card review"><span>REVIEW</span><h2>Grey-area</h2><p>Manipulation-risk tactics require explicit human review.</p><ul><li>Paid placements</li><li>Large-scale guest posting</li><li>Programmatic landing pages</li><li>Community seeding</li></ul></article>
    </section>}
  </>;
}