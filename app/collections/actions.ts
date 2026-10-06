"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {adminMutation} from "@/lib/admin-server";

export async function createCollectionAction(formData:FormData){
  const result=await adminMutation<any>("/v1/admin/collections",{
    method:"POST",
    body:JSON.stringify({
      title:String(formData.get("title")||"").trim(),
      handle:String(formData.get("handle")||"").trim(),
      subtitle:String(formData.get("subtitle")||"").trim()||null,
      description:String(formData.get("description")||"").trim()||null,
      imageUrl:String(formData.get("imageUrl")||"").trim()||null,
      status:String(formData.get("status")||"active"),
      position:Number(formData.get("position")||0),
    }),
  });
  revalidatePath("/collections");
  redirect("/collections/"+result.id);
}

export async function updateCollectionAction(id:string,formData:FormData){
  await adminMutation("/v1/admin/collections/"+id,{
    method:"PATCH",
    body:JSON.stringify({
      title:String(formData.get("title")||"").trim(),
      handle:String(formData.get("handle")||"").trim(),
      subtitle:String(formData.get("subtitle")||"").trim()||null,
      description:String(formData.get("description")||"").trim()||null,
      imageUrl:String(formData.get("imageUrl")||"").trim()||null,
      status:String(formData.get("status")||"active"),
      position:Number(formData.get("position")||0),
    }),
  });
  const productIds=formData.getAll("productIds").map(String);
  const orderedProductIds=productIds
    .map((productId,index)=>({productId,position:Number(formData.get("position__"+productId)??index)}))
    .sort((a,b)=>a.position-b.position)
    .map(item=>item.productId);
  await adminMutation("/v1/admin/collections/"+id+"/products",{method:"PUT",body:JSON.stringify({productIds:orderedProductIds})});
  revalidatePath("/collections");
  revalidatePath("/collections/"+id);
}

export async function saveCollectionSeoAction(id:string,handle:string,formData:FormData){
  await adminMutation("/v1/admin/seo/collection/"+encodeURIComponent(id),{
    method:"PUT",
    body:JSON.stringify({
      title:String(formData.get("seoTitle")||"").trim()||null,
      metaDescription:String(formData.get("metaDescription")||"").trim()||null,
      canonicalPath:String(formData.get("canonicalPath")||("/collections/"+handle)).trim(),
      index:formData.get("index")==="on",
      follow:true,
      schemaType:"CollectionPage",
      metadata:{},
    }),
  });
  revalidatePath("/collections/"+id);
}
