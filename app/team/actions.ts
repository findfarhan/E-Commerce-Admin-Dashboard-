"use server";
import {revalidatePath} from "next/cache";
import {adminMutation} from "@/lib/admin-server";

export async function createStaffUserAction(formData:FormData){
  const roleIds=formData.getAll("roleIds").map(String);
  await adminMutation("/v1/admin/team/users",{method:"POST",body:JSON.stringify({
    name:String(formData.get("name")||"").trim(),
    email:String(formData.get("email")||"").trim().toLowerCase(),
    password:String(formData.get("password")||""),
    roleIds,
  })});
  revalidatePath("/team");
}
export async function updateStaffUserAction(id:string,formData:FormData){
  await adminMutation("/v1/admin/team/users/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({
    name:String(formData.get("name")||"").trim(),
    status:String(formData.get("status")||"active"),
    password:String(formData.get("password")||"").trim()||undefined,
    roleIds:formData.getAll("roleIds").map(String),
  })});
  revalidatePath("/team");
}
