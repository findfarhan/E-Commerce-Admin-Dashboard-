"use server";
import {revalidatePath} from "next/cache";
import {adminMutation} from "@/lib/admin-server";

export async function createRedirectAction(formData:FormData){
  await adminMutation("/v1/admin/redirects",{
    method:"POST",
    body:JSON.stringify({
      sourcePath:String(formData.get("sourcePath")||"").trim(),
      targetPath:String(formData.get("targetPath")||"").trim(),
      statusCode:Number(formData.get("statusCode")||301),
    }),
  });
  revalidatePath("/seo/redirects");
}

export async function deleteRedirectAction(id:string){
  await adminMutation("/v1/admin/redirects/"+encodeURIComponent(id),{method:"DELETE"});
  revalidatePath("/seo/redirects");
}
