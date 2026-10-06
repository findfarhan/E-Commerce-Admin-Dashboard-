import {NextRequest,NextResponse} from "next/server";
const apiBase=(process.env.NEXT_PUBLIC_API_URL||"https://e-commerce-admin-dashboard-ptgs.onrender.com").replace(/\/$/,"");
export async function POST(request:NextRequest){
  const key=process.env.ADMIN_API_KEY;
  if(!key) return NextResponse.json({error:"ADMIN_API_KEY is not configured"},{status:503});
  const body=await request.json();
  const action=String(body?.action||"");
  let path="",payload:any={};
  if(action==="upload-url"){
    path="/v1/admin/products/"+encodeURIComponent(String(body.productId))+"/media/upload-url";
    payload={filename:body.filename,contentType:body.contentType,altText:body.altText||null,role:body.role||"gallery",position:Number(body.position||0),mediaSetId:body.mediaSetId||null,focalX:Number(body.focalX??0.5),focalY:Number(body.focalY??0.5)};
  }else if(action==="finalize"){
    path="/v1/admin/media/"+encodeURIComponent(String(body.mediaId))+"/finalize";
  }else return NextResponse.json({error:"Unsupported media action"},{status:400});
  const response=await fetch(apiBase+path,{method:"POST",headers:{"Content-Type":"application/json","X-Admin-Key":key},body:JSON.stringify(payload),cache:"no-store"});
  const text=await response.text();
  let data:any;try{data=JSON.parse(text);}catch{data={error:text||response.statusText};}
  return NextResponse.json(data,{status:response.status});
}