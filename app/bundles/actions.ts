"use server";
import {revalidatePath} from "next/cache";
import {adminMutation} from "@/lib/admin-server";

export type BundleActionState={ok:boolean;message:string};
export async function saveBundleAction(_:BundleActionState,form:FormData):Promise<BundleActionState>{
  try{
    const id=String(form.get("id")||"").trim();
    const components=JSON.parse(String(form.get("components")||"[]")) as unknown;
    if(!Array.isArray(components)||components.length<2)throw new Error("Select at least two different jewelry variations.");
    const body={
      title:String(form.get("title")||"").trim(),
      handle:String(form.get("handle")||"").trim().toLowerCase(),
      description:String(form.get("description")||"").trim(),
      status:String(form.get("status")||"draft"),
      discountKind:String(form.get("discountKind")||"percentage"),
      discountValue:Number(form.get("discountValue")),
      startsAt:String(form.get("startsAt")||"")||null,
      endsAt:String(form.get("endsAt")||"")||null,
      components,
    };
    await adminMutation(id?"/v1/admin/bundles/"+encodeURIComponent(id):"/v1/admin/bundles",{
      method:id?"PATCH":"POST",body:JSON.stringify(body),
    });
    revalidatePath("/bundles");
    return {ok:true,message:id?"Bundle saved. Existing open checkouts with changed contents will require review.":"Bundle created successfully."};
  }catch(e){
    return {ok:false,message:e instanceof Error?e.message:"Unable to save bundle."};
  }
}
export async function archiveBundleAction(form:FormData){
  const id=String(form.get("id")||"");
  if(!id)throw new Error("Bundle ID is required");
  await adminMutation("/v1/admin/bundles/"+encodeURIComponent(id),{method:"DELETE"});
  revalidatePath("/bundles");
}
