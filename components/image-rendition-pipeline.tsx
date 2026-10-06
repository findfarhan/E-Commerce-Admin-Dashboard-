"use client";

import {useState} from "react";

const presets=[
  ["Admin thumbnail","160 × 160","1:1","Auto"],
  ["Store thumbnail","320 × 320","1:1","Auto"],
  ["Product card / mobile","640 × 800","4:5","Auto"],
  ["Product card / desktop","900 × 1125","4:5","Auto"],
  ["PDP / mobile","900 × 1125","4:5","Auto"],
  ["PDP / desktop","1200 × 1500","4:5","Auto"],
  ["Zoom","2000 × 2500","4:5","Auto"],
  ["Hero / mobile","1080 × 1350","4:5","Auto"],
  ["Hero / desktop","1920 × 1080","16:9","Auto"],
  ["Social / OG","1200 × 630","1.91:1","Auto"],
];

export function ImageRenditionPipeline(){
  const [x,setX]=useState(50);
  const [y,setY]=useState(45);

  return <article className="panel image-pipeline">
    <div className="variant-panel-title">
      <div>
        <h3>One master → Cloudflare responsive delivery</h3>
        <p>Upload once to R2. The original stays untouched while Cloudflare generates the right size, crop and modern format at delivery time.</p>
      </div>
      <span className="free-tier-chip">CLOUDFLARE</span>
    </div>

    <div className="image-upload-grid">
      <section className="master-image-card">
        <div className="image-card-head">
          <div><span>MASTER ASSET</span><b>celestia-ring-master.jpg</b></div>
          <small>4000 × 5000 · original</small>
        </div>
        <div className="master-preview"><i className="focal-marker" style={{left:x+"%",top:y+"%"}}/></div>
        <div className="master-meta">
          <div><span>STORAGE</span><b>Cloudflare R2</b></div>
          <div><span>FOCAL X</span><b>{x}%</b></div>
          <div><span>FOCAL Y</span><b>{y}%</b></div>
          <div><span>MASTER</span><b>Preserved</b></div>
        </div>
      </section>

      <section className="focal-preview-card">
        <div className="image-card-head"><div><span>FOCAL CONTROL</span><b>Keep jewelry inside every crop</b></div></div>
        <div className="crop-previews">
          <div className="crop-preview square"><div className="crop-image"/><span>1:1</span></div>
          <div className="crop-preview portrait"><div className="crop-image"/><span>4:5</span></div>
          <div className="crop-preview wide"><div className="crop-image"/><span>16:9</span></div>
        </div>
        <div className="focal-controls">
          <label><span>Focal X · {x}%</span><input type="range" min="0" max="100" value={x} onChange={e=>setX(Number(e.target.value))}/></label>
          <label><span>Focal Y · {y}%</span><input type="range" min="0" max="100" value={y} onChange={e=>setY(Number(e.target.value))}/></label>
        </div>
        <p className="focal-hint">The focal point maps to Cloudflare image gravity, so future theme sizes can change without another upload.</p>
      </section>
    </div>

    <div className="rendition-summary">
      <span className="rendition-chip"><b>1</b> stored master</span>
      <span className="rendition-chip"><b>10</b> delivery presets</span>
      <span className="rendition-chip"><b>0</b> required duplicate uploads</span>
      <span className="rendition-chip"><b>Auto</b> WebP / AVIF</span>
    </div>

    <div className="rendition-table">
      <table>
        <thead><tr><th>USE CASE</th><th>SIZE</th><th>ASPECT</th><th>FORMAT</th><th>MODE</th></tr></thead>
        <tbody>{presets.map(([name,size,aspect,format],i)=><tr key={name}>
          <td><b>{name}</b><small>{"preset_"+(i+1)}</small></td>
          <td>{size}</td>
          <td>{aspect}</td>
          <td><span className="format-pills"><span>{format}</span></span></td>
          <td className="rendition-ready">Dynamic</td>
        </tr>)}</tbody>
      </table>
    </div>

    <section className="r2-storage-card">
      <div className="r2-storage-head">
        <div><span>CLOUDFLARE MEDIA</span><b>R2 master storage + Image Resizing delivery</b></div>
        <small>Provider-neutral backend contract</small>
      </div>
      <div className="r2-storage-grid">
        <div><span>MASTER</span><code>masters/.../original.jpg</code></div>
        <div><span>TRANSFORM</span><b>/cdn-cgi/image/...</b></div>
        <div><span>UPLOAD</span><b>Presigned direct PUT</b></div>
        <div><span>FALLBACK</span><b>Sharp → R2</b></div>
      </div>
      <p className="r2-storage-flow">Admin → Render authorization → direct R2 upload → metadata finalize → Cloudflare dynamically serves card, PDP, hero, zoom and social sizes. If Image Resizing is not enabled yet, the existing Sharp/R2 worker remains the fallback.</p>
    </section>
  </article>
}