"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";

const apiBase=(process.env.NEXT_PUBLIC_API_URL||"https://e-commerce-admin-dashboard-ptgs.onrender.com").replace(/\/$/,"");

async function request(path:string,init:RequestInit){
  const adminKey=process.env.ADMIN_API_KEY;
  if(!adminKey) throw new Error("ADMIN_API_KEY is not configured on the Admin Vercel project.");
  const response=await fetch(apiBase+path,{
    ...init,
    headers:{
      "Content-Type":"application/json",
      "X-Admin-Key":adminKey,
      ...(init.headers||{}),
    },
    cache:"no-store",
  });
  if(!response.ok){
    const body=await response.text();
    throw new Error(body||("Admin API request failed with "+response.status));
  }
  return response.json();
}

export async function createProductAction(formData:FormData){
  const title=String(formData.get("title")||"").trim();
  const handle=String(formData.get("handle")||"").trim();
  if(!title||!handle) throw new Error("Title and handle are required.");

  const result=await request("/v1/admin/products",{
    method:"POST",
    body:JSON.stringify({
      title,
      handle,
      description:String(formData.get("description")||"").trim()||null,
      category:String(formData.get("category")||"").trim()||null,
      material:String(formData.get("material")||"").trim()||null,
      tag:String(formData.get("tag")||"").trim()||null,
      status:String(formData.get("status")||"draft"),
      featured:formData.get("featured")==="on",
      price:Number(formData.get("price")||0),
      inventory:Number(formData.get("inventory")||0),
      sku:String(formData.get("sku")||"").trim()||undefined,
    }),
  });

  revalidatePath("/products");
  redirect("/products/"+result.product.id);
}

export async function updateProductAction(id:string,formData:FormData){
  await request("/v1/admin/products/"+encodeURIComponent(id),{
    method:"PATCH",
    body:JSON.stringify({
      title:String(formData.get("title")||"").trim(),
      handle:String(formData.get("handle")||"").trim(),
      description:String(formData.get("description")||"").trim()||null,
      category:String(formData.get("category")||"").trim()||null,
      material:String(formData.get("material")||"").trim()||null,
      tag:String(formData.get("tag")||"").trim()||null,
      status:String(formData.get("status")||"draft"),
      featured:formData.get("featured")==="on",
    }),
  });

  revalidatePath("/products");
  revalidatePath("/products/"+id);
  redirect("/products/"+id);
}
