"use server";
import {revalidatePath} from "next/cache";
import {adminMutation} from "@/lib/admin-server";
export type PackagingActionState={ok:boolean;message:string;id?:string};
export async function savePackagingAction(_:PackagingActionState,form:FormData):Promise<PackagingActionState>{
 try{
  const id=String(form.get("id")||"");
  const body={
   sku:String(form.get("sku")||"").trim().toUpperCase(),
   title:String(form.get("title")||"").trim(),
   description:String(form.get("description")||"").trim(),
   imageUrl:String(form.get("imageUrl")||"").trim(),
   status:String(form.get("status")||"draft"),
   price:Number(form.get("price")),
   inventory:Number(form.get("inventory")),
   weightGrams:Number(form.get("weightGrams")),
   taxable:form.get("taxable")==="on",
   position:Number(form.get("position")),
  };
  const result=await adminMutation<{ok:boolean;id:string}>(
   id?"/v1/admin/gift-packaging/"+encodeURIComponent(id):"/v1/admin/gift-packaging",
   {method:id?"PATCH":"POST",body:JSON.stringify(body)});
  revalidatePath("/gift-packaging");
  return {ok:true,message:id?"Gift packaging updated. Current checkout quotes will be revalidated.":"Gift packaging option created.",id:result.id};
 }catch(error){return {ok:false,message:error instanceof Error?error.message:"Could not save packaging option"};}
}
export async function archivePackagingAction(form:FormData){
 const id=String(form.get("id")||"");
 if(!id)throw new Error("Packaging selection required");
 await adminMutation("/v1/admin/gift-packaging/"+encodeURIComponent(id),{method:"DELETE"});
 revalidatePath("/gift-packaging");
}
