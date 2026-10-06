"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {finalizeManagedMediaUploadAction,requestManagedMediaUploadAction} from "@/app/products/actions";

export function ManagedMediaUpload({productId,mediaSets}:{productId:string;mediaSets:Array<{id:string;name:string}>}){
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setMessage("");
    try{
      const form=new FormData(event.currentTarget);
      const file=form.get("file");
      if(!(file instanceof File)||!file.size) throw new Error("Choose an image first.");
      if(file.size>20*1024*1024) throw new Error("Master image must be 20 MB or smaller.");
      const upload:any=await requestManagedMediaUploadAction(productId,{
        filename:file.name,contentType:file.type||"image/jpeg",altText:String(form.get("altText")||""),
        role:String(form.get("role")||"gallery"),position:Number(form.get("position")||0),
        mediaSetId:String(form.get("mediaSetId")||"")||null,focalX:Number(form.get("focalX")||.5),focalY:Number(form.get("focalY")||.5),
      });
      const response=await fetch(upload.uploadUrl,{method:"PUT",headers:{"Content-Type":file.type||"image/jpeg"},body:file});
      if(!response.ok) throw new Error("Object upload failed with "+response.status);
      const finalized:any=await finalizeManagedMediaUploadAction(productId,upload.mediaId);
      setMessage(finalized?.status==="queued"?"Uploaded. Responsive renditions queued.":"Uploaded and ready.");
      (event.currentTarget as HTMLFormElement).reset();
      router.refresh();
    }catch(error:any){setMessage(error?.message||"Upload failed.");}
    finally{setBusy(false);}
  }
  return <form onSubmit={submit} className="field-grid">
    <label className="field" style={{gridColumn:"1 / -1"}}><span>Master image</span><input name="file" type="file" accept="image/*" required/></label>
    <label className="field"><span>Role</span><select name="role"><option value="gallery">Gallery</option><option value="primary">Primary</option></select></label>
    <label className="field"><span>Media set</span><select name="mediaSetId"><option value="">None / default</option>{mediaSets.map(set=><option key={set.id} value={set.id}>{set.name}</option>)}</select></label>
    <label className="field"><span>Alt text</span><input name="altText"/></label><label className="field"><span>Position</span><input name="position" type="number" min="0" defaultValue="0"/></label>
    <label className="field"><span>Focal X</span><input name="focalX" type="number" min="0" max="1" step=".01" defaultValue=".5"/></label><label className="field"><span>Focal Y</span><input name="focalY" type="number" min="0" max="1" step=".01" defaultValue=".5"/></label>
    <button className="primary-button" type="submit" disabled={busy}>{busy?"Uploading…":"Upload master"}</button>
    {message&&<small style={{color:"var(--muted)"}}>{message}</small>}
  </form>;
}
