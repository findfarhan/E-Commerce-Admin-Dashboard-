import {Logger} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import sharp from "sharp";
import {CloudflareR2Storage} from "./cloudflare-r2.storage";

const log=new Logger("R2_IMAGE_SMOKE");
const ADMIN_ORIGIN="https://ecommerceadmin-jade.vercel.app";

/**
 * Opt-in, one-shot production diagnostic. Runs in the backend where R2
 * credentials already exist; never exposes them or signs a public endpoint.
 *
 * Uploads a synthetic PNG through the actual browser-facing presigned PUT
 * flow; reads the object back through authenticated S3 and public CDN;
 * verifies checksum and always removes the object. No product/database edits.
 *
 * Enable temporarily with R2_IMAGE_SMOKE_TEST=1; remove the flag afterwards.
 */
export async function runR2ImageSmoke(storage:CloudflareR2Storage):Promise<void>{
  const key="qa-smoke/jewelry/"+Date.now()+"-"+randomUUID()+".png";
  let mayExist=false, stage="create_image";
  let publicStatus="not-tested",preflight="not-tested",checksum=false;
  try{
    const image=await sharp({
      create:{width:128,height:128,channels:3,background:{r:31,g:25,b:43}},
    }).png().toBuffer();
    const checksumOf=(buffer:Buffer)=>createHash("sha256").update(buffer).digest("hex");
    stage="sign_upload";
    const signedUrl=await storage.createSignedUploadUrl(key,"image/png",120);
    // Test the browser preflight independently of the successful server PUT.
    stage="cors_preflight";
    try{
      const cors=await fetch(signedUrl,{
        method:"OPTIONS",redirect:"manual",
        headers:{
          Origin:ADMIN_ORIGIN,
          "Access-Control-Request-Method":"PUT",
          "Access-Control-Request-Headers":"content-type",
        },
        signal:AbortSignal.timeout(12000),
      });
      const origin=cors.headers.get("access-control-allow-origin")||"";
      const methods=(cors.headers.get("access-control-allow-methods")||"").toUpperCase();
      const headers=(cors.headers.get("access-control-allow-headers")||"").toLowerCase();
      const corsOK=cors.ok&&(origin===ADMIN_ORIGIN||origin==="*")&&methods.includes("PUT")&&headers.includes("content-type");
      preflight=(corsOK?"PASS":"FAIL")+" HTTP "+cors.status;
    }catch(error){
      preflight="FAIL network "+(error instanceof Error?error.name:"Unknown");
    }
    stage="signed_put";
    // DELETE is always attempted even when the PUT response becomes uncertain.
    mayExist=true;
    const put=await fetch(signedUrl,{
      method:"PUT",body:new Uint8Array(image),
      headers:{"Content-Type":"image/png"},
      signal:AbortSignal.timeout(22000),
    });
    if(!put.ok) throw new Error("SIGNED_PUT_HTTP_"+put.status);
    stage="private_head";
    const head=await storage.head(key);
    if(Number(head.contentLength)!==image.length)throw new Error("HEAD_SIZE_MISMATCH");
    stage="private_read";
    const stored=await storage.getBuffer(key);
    checksum=checksumOf(image)===checksumOf(stored);
    if(!checksum)throw new Error("PRIVATE_CHECKSUM_MISMATCH");
    stage="public_delivery";
    const publicUrl=storage.publicUrl(key);
    if(!publicUrl)throw new Error("PUBLIC_BASE_URL_MISSING");
    const res=await fetch(publicUrl,{
      cache:"no-store",signal:AbortSignal.timeout(20000),
    });
    publicStatus="HTTP "+res.status;
    if(!res.ok)throw new Error("PUBLIC_HTTP_"+res.status);
    const publicBody=Buffer.from(await res.arrayBuffer());
    if(checksumOf(image)!==checksumOf(publicBody))throw new Error("PUBLIC_CHECKSUM_MISMATCH");
    log.log("PASS signed_put=PASS private_head=PASS private_read=PASS public_delivery=PASS bytes="+
      image.length+" cors_preflight="+preflight+" public="+publicStatus);
  }catch(error){
    // Never log presigned URL, cloud credentials, request headers or tokens.
    const name=error instanceof Error?error.name:"Unknown";
    const safe=error instanceof Error&&/^(SIGNED_PUT_HTTP_\d+|HEAD_SIZE_MISMATCH|PRIVATE_CHECKSUM_MISMATCH|PUBLIC_BASE_URL_MISSING|PUBLIC_HTTP_\d+|PUBLIC_CHECKSUM_MISMATCH)$/.test(error.message)?error.message:name;
    log.error("FAIL stage="+stage+" category="+safe+
      " cors_preflight="+preflight+" public="+publicStatus+" checksum="+checksum);
  }finally{
    if(mayExist){
      try{await storage.delete(key);log.log("CLEANUP PASS temporary_image_removed");}
      catch(error){log.error("CLEANUP FAIL category="+(error instanceof Error?error.name:"Unknown"));}
    }
  }
}
