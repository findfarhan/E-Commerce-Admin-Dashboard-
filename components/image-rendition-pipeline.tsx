"use client";

import {useState} from "react";

const presets=[
  ["Admin thumbnail","160 × 160","1:1","WebP"],
  ["Store thumbnail","320 × 320","1:1","WebP + AVIF"],
  ["Product card / mobile","640 × 800","4:5","WebP + AVIF"],
  ["Product card / desktop","900 × 1125","4:5","WebP + AVIF"],
  ["PDP / mobile","900 × 1125","4:5","WebP + AVIF"],
  ["PDP / desktop","1200 × 1500","4:5","WebP + AVIF"],
  ["Zoom","2000 × 2500","4:5","WebP"],
  ["Hero / mobile","1080 × 1350","4:5","WebP + AVIF"],
  ["Hero / desktop","1920 × 1080","16:9","WebP + AVIF"],
  ["Social / OG","1200 × 630","1.91:1","WebP"],
];

export function ImageRenditionPipeline(){
  const [x,setX]=useState(50);
  const [y,setY]=useState(45);
  return <article className="panel image-pipeline">
    <div className="variant-panel-title"><div><h3>Single master upload → automatic renditions</h3><p>Upload once. Preserve the original in Cloudflare R2 and generate every storefront/admin rendition from the same master plus focal point.</p></div><span className="free-tier-chip">R2 STORAGE</span></div>
    <div className="image-upload-grid">
      <section className="master-image-card"><div className="image-card-head"><div><span>MASTER ASSET</span><b>celestia-ring-master.jpg</b></div><small>4000 × 5000 · original</small></div><div className="master-preview"><i className="focal-marker" style={{left:x+"%",top:y+"%"}}/></div><div className="master-meta"><div><span>ORIGINAL</span><b>Preserved</b></div><div><span>FOCAL X</span><b>{x}%</b></div><div><span>FOCAL Y</span><b>{y}%</b></div><div><span>STATUS</span><b>Ready</b></div></div></section>
      <section className="focal-preview-card"><div className="image-card-head"><div><span>FOCAL CONTROL</span><b>Keep jewelry inside every crop</b></div></div><div className="crop-previews"><div className="crop-preview square"><div className="crop-image"/><span>1:1</span></div><div className="crop-preview portrait"><div className="crop-image"/><span>4:5</span></div><div className="crop-preview wide"><div className="crop-image"/><span>16:9</span></div></div><div className="focal-controls"><label><span>Focal X · {x}%</span><input type="range" min="0" max="100" value={x} onChange={e=>setX(Number(e.target.value))}/></label><label><span>Focal Y · {y}%</span><input type="range" min="0" max="100" value={y} onChange={e=>setY(Number(e.target.value))}/></label></div><p className="focal-hint">Preset sizes can change later without asking for another upload because the original master stays in R2.</p></section>
    </div>
    <div className="rendition-summary"><span className="rendition-chip"><b>10</b> use-cases</span><span className="rendition-chip"><b>18</b> optimized files</span><span className="rendition-chip"><b>1</b> upload</span><span className="rendition-chip"><b>2</b> modern formats</span></div>
    <div className="rendition-table"><table><thead><tr><th>USE CASE</th><th>SIZE</th><th>ASPECT</th><th>FORMAT</th><th>STATUS</th></tr></thead><tbody>{presets.map(([name,size,aspect,format],i)=><tr key={name}><td><b>{name}</b><small>{"preset_"+(i+1)}</small></td><td>{size}</td><td>{aspect}</td><td><span className="format-pills">{format.split(" + ").map(f=><span key={f}>{f}</span>)}</span></td><td className="rendition-ready">Ready</td></tr>)}</tbody></table></div>
    <section className="r2-storage-card"><div className="r2-storage-head"><div><span>CLOUDFLARE R2</span><b>Durable master + rendition storage</b></div><small>Configured by Render env</small></div><div className="r2-storage-grid"><div><span>MASTER KEY</span><code>masters/products/p1/...</code></div><div><span>RENDITION KEY</span><code>renditions/p1/...</code></div><div><span>UPLOAD</span><b>Presigned direct</b></div><div><span>PUBLIC DELIVERY</span><b>R2 custom domain</b></div></div><p className="r2-storage-flow">Admin asks Render for a signed R2 URL → browser uploads directly to R2 → Render finalizes metadata → image job generates renditions → storefront consumes semantic media URLs.</p></section>
  </article>
}