"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
export function MediaUploader({productId,mediaSets}:{productId:string;mediaSets:Array<{id:string;name:string}>}){
  const router=useRouter();const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
  async function upload(formData:FormData){
    const file=formData.get("file");if(!(file instanceof File)||!file.size){setMessage("Choose an image first.");return;}
    setBusy(true);setMessage("");
    try{
      const req=await fetch("/api/media",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"upload-url",productId,filename:file.name,contentType:file.type||"image/jpeg",altText:String(formData.get("altText")||""),role:String(formData.get("role")||"gallery"),position:Number(formData.get("position")||0),mediaSetId:String(formData.get("mediaSetId")||"")||null,focalX:Number(formData.get("focalX")||0.5),focalY:Number(formData.get("focalY")||0.5)})});
      const ticket=await req.json();if(!req.ok)throw new Error(ticket.message||ticket.error||"Upload provider unavailable");
      const put=await fetch(ticket.uploadUrl,{method:"PUT",headers:{"Content-Type":file.type||"image/jpeg"},body:file});if(!put.ok)throw new Error("Direct object upload failed. Check R2 CORS/configuration.");
      const fin=await fetch("/api/media",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"finalize",mediaId:ticket.mediaId})});
      const result=await fin.json();if(!fin.ok)throw new Error(result.message||result.error||"Media finalize failed");
      setMessage(result.status==="queued"?"Uploaded. Responsive renditions are processing.":"Uploaded and ready.");router.refresh();
    }catch(error){setMessage(error instanceof Error?error.message:"Upload failed");}finally{setBusy(false);}
  }
  return <form action={upload} className="field-grid">
    <label className="field"><span>Master image</span><input name="file" type="file" accept="image/*" required/></label>
    <label className="field"><span>Alt text</span><input name="altText"/></label>
    <label className="field"><span>Role</span><select name="role"><option value="gallery">Gallery</option><option value="primary">Primary</option></select></label>
    <label className="field"><span>Media set</span><select name="mediaSetId"><option value="">General</option>{mediaSets.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <label className="field"><span>Position</span><input name="position" type="number" min="0" defaultValue="0"/></label>
    <label className="field"><span>Focal X (0–1)</span><input name="focalX" type="number" min="0" max="1" step="0.01" defaultValue="0.5"/></label>
    <label className="field"><span>Focal Y (0–1)</span><input name="focalY" type="number" min="0" max="1" step="0.01" defaultValue="0.5"/></label>
    <div className="page-actions"><button className="primary-button" disabled={busy}>{busy?"Uploading…":"Upload master image"}</button></div>
    {message&&<p style={{gridColumn:"1/-1"}}>{message}</p>}
  </form>;
}