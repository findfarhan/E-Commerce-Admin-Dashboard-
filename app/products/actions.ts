"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {requireAdminPermission} from "@/lib/admin-server-session";

const apiBase=(process.env.NEXT_PUBLIC_API_URL||"https://e-commerce-admin-dashboard-ptgs.onrender.com").replace(/\/$/,"");

async function request(path:string,init:RequestInit){
  const session=await requireAdminPermission("catalog.write");
  const adminKey=process.env.ADMIN_API_KEY;
  if(!adminKey) throw new Error("ADMIN_API_KEY is not configured on the Admin Vercel project.");
  const response=await fetch(apiBase+path,{
    ...init,
    headers:{
      "Content-Type":"application/json",
      "X-Admin-Key":adminKey,
      "X-Admin-Actor":session.email,
      "X-Admin-Role":session.role,
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

  await request("/v1/admin/products/"+encodeURIComponent(result.product.id)+"/organization",{
    method:"PATCH",
    body:JSON.stringify({
      vendor:String(formData.get("vendor")||"").trim()||null,
      productType:String(formData.get("productType")||"").trim()||null,
      tags:String(formData.get("tags")||"").split(",").map(v=>v.trim()).filter(Boolean),
      publishedAt:String(formData.get("publishedAt")||"").trim()||null,
      taxable:formData.get("taxable")==="on",
      weightGrams:formData.get("weightGrams")?Number(formData.get("weightGrams")):null,
      searchAttributes:{},
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

  await request("/v1/admin/products/"+encodeURIComponent(id)+"/organization",{
    method:"PATCH",
    body:JSON.stringify({
      vendor:String(formData.get("vendor")||"").trim()||null,
      productType:String(formData.get("productType")||"").trim()||null,
      tags:String(formData.get("tags")||"").split(",").map(v=>v.trim()).filter(Boolean),
      publishedAt:String(formData.get("publishedAt")||"").trim()||null,
      taxable:formData.get("taxable")==="on",
      weightGrams:formData.get("weightGrams")?Number(formData.get("weightGrams")):null,
      searchAttributes:{},
    }),
  });
  revalidatePath("/products");
  revalidatePath("/products/"+id);
  redirect("/products/"+id);
}


export async function createOptionAction(id:string,formData:FormData){
  const name=String(formData.get("name")||"").trim();
  const values=String(formData.get("values")||"").split(",").map(v=>v.trim()).filter(Boolean);
  if(!name||!values.length) throw new Error("Option name and at least one value are required.");

  await request("/v1/admin/products/"+encodeURIComponent(id)+"/options",{
    method:"POST",
    body:JSON.stringify({
      name,
      values,
      isVisual:formData.get("isVisual")==="on",
      position:Number(formData.get("position")||0),
    }),
  });

  revalidatePath("/products/"+id);
}

export async function createVariantAction(id:string,formData:FormData){
  const selectedOptions:Record<string,string>={};
  for(const [key,value] of formData.entries()){
    if(key.startsWith("option__")) selectedOptions[key.slice(8)]=String(value);
  }

  await request("/v1/admin/products/"+encodeURIComponent(id)+"/variants",{
    method:"POST",
    body:JSON.stringify({
      sku:String(formData.get("sku")||"").trim(),
      price:Number(formData.get("price")||0),
      compareAtPrice:formData.get("compareAtPrice")?Number(formData.get("compareAtPrice")):null,
      inventory:Number(formData.get("inventory")||0),
      status:String(formData.get("status")||"active"),
      mediaSetId:String(formData.get("mediaSetId")||"").trim()||null,
      selectedOptions,
    }),
  });

  revalidatePath("/products");
  revalidatePath("/products/"+id);
}

export async function createMediaSetAction(id:string,formData:FormData){
  const matchOptions:Record<string,string>={};
  for(const [key,value] of formData.entries()){
    if(key.startsWith("visual__")) matchOptions[key.slice(8)]=String(value);
  }

  await request("/v1/admin/products/"+encodeURIComponent(id)+"/media-sets",{
    method:"POST",
    body:JSON.stringify({
      name:String(formData.get("name")||"").trim(),
      matchOptions,
      isDefault:formData.get("isDefault")==="on",
    }),
  });

  revalidatePath("/products/"+id);
}


export async function generateVariantsAction(id:string,formData:FormData){
  await request("/v1/admin/products/"+encodeURIComponent(id)+"/variants/generate",{
    method:"POST",
    body:JSON.stringify({
      baseSku:String(formData.get("baseSku")||"").trim()||undefined,
      price:Number(formData.get("price")||0),
      inventory:Number(formData.get("inventory")||0),
    }),
  });
  revalidatePath("/products");
  revalidatePath("/products/"+id);
}

export async function updateVariantAction(productId:string,variantId:string,formData:FormData){
  await request("/v1/admin/products/"+encodeURIComponent(productId)+"/variants/"+encodeURIComponent(variantId),{
    method:"PATCH",
    body:JSON.stringify({
      sku:String(formData.get("sku")||"").trim(),
      price:Number(formData.get("price")||0),
      status:String(formData.get("status")||"active"),
      mediaSetId:String(formData.get("mediaSetId")||"").trim()||null,
    }),
  });
  revalidatePath("/products");
  revalidatePath("/products/"+productId);
}

export async function adjustInventoryAction(productId:string,variantId:string,formData:FormData){
  await request("/v1/admin/inventory/variants/"+encodeURIComponent(variantId)+"/adjust",{
    method:"POST",
    body:JSON.stringify({
      delta:Number(formData.get("delta")||0),
      reason:String(formData.get("reason")||"").trim()||"Manual adjustment",
      actor:"admin",
    }),
  });
  revalidatePath("/products");
  revalidatePath("/products/"+productId);
}

export async function archiveVariantAction(productId:string,variantId:string){
  await request("/v1/admin/products/"+encodeURIComponent(productId)+"/variants/"+encodeURIComponent(variantId),{method:"DELETE"});
  revalidatePath("/products");
  revalidatePath("/products/"+productId);
}

export async function saveProductSeoAction(productId:string,handle:string,formData:FormData){
  await request("/v1/admin/seo/product/"+encodeURIComponent(productId),{
    method:"PUT",
    body:JSON.stringify({
      title:String(formData.get("title")||"").trim()||null,
      metaDescription:String(formData.get("metaDescription")||"").trim()||null,
      canonicalPath:String(formData.get("canonicalPath")||("/product/"+handle)).trim(),
      index:formData.get("index")==="on",
      follow:true,
      schemaType:"Product",
      metadata:{},
    }),
  });
  revalidatePath("/products/"+productId);
}


export async function updateOptionAction(productId:string,optionId:string,formData:FormData){
  const values=String(formData.get("values")||"").split(",").map(value=>value.trim()).filter(Boolean);
  await request("/v1/admin/products/"+encodeURIComponent(productId)+"/options/"+encodeURIComponent(optionId),{
    method:"PATCH",
    body:JSON.stringify({
      name:String(formData.get("name")||"").trim(),
      values,
      isVisual:formData.get("isVisual")==="on",
      position:Number(formData.get("position")||0),
    }),
  });
  revalidatePath("/products/"+productId);
}

export async function deleteOptionAction(productId:string,optionId:string){
  await request("/v1/admin/products/"+encodeURIComponent(productId)+"/options/"+encodeURIComponent(optionId),{method:"DELETE"});
  revalidatePath("/products/"+productId);
}

export async function archiveProductAction(productId:string){
  await request("/v1/admin/products/"+encodeURIComponent(productId),{method:"DELETE"});
  revalidatePath("/products");
  redirect("/products");
}


export async function createSourceMediaAction(productId:string,formData:FormData){
  await request("/v1/admin/products/"+encodeURIComponent(productId)+"/media/source",{
    method:"POST",
    body:JSON.stringify({
      sourceUrl:String(formData.get("sourceUrl")||"").trim(),
      altText:String(formData.get("altText")||"").trim()||null,
      role:String(formData.get("role")||"gallery"),
      position:Number(formData.get("position")||0),
      mediaSetId:String(formData.get("mediaSetId")||"").trim()||null,
    }),
  });
  revalidatePath("/products/"+productId);
}


export async function duplicateProductAction(productId:string){
  const result:any=await request("/v1/admin/products/"+encodeURIComponent(productId)+"/duplicate",{method:"POST"});
  revalidatePath("/products");
  redirect("/products/"+result.product.id);
}

export async function saveProductMetafieldsAction(productId:string,formData:FormData){
  const values:any[]=[];
  for(const [key,value] of formData.entries()){
    if(!key.startsWith("mftype__")) continue;
    const definitionId=key.slice(8);
    const type=String(value);
    const raw=type==="boolean"?formData.get("mf__"+definitionId)==="on":formData.get("mf__"+definitionId);
    values.push({definitionId,value:raw});
  }
  await request("/v1/admin/metafields/product/"+encodeURIComponent(productId),{method:"PUT",body:JSON.stringify({values})});
  revalidatePath("/products/"+productId);
}

export async function saveVariantCostAction(productId:string,variantId:string,formData:FormData){
  await request("/v1/admin/variants/"+encodeURIComponent(variantId)+"/cost",{
    method:"PATCH",
    body:JSON.stringify({costAmount:Number(formData.get("costAmount")||0),weightGrams:formData.get("weightGrams")?Number(formData.get("weightGrams")):null}),
  });
  revalidatePath("/products/"+productId);
  revalidatePath("/analytics");
}

export async function updateMediaAction(productId:string,mediaId:string,formData:FormData){
  await request("/v1/admin/media/"+encodeURIComponent(mediaId),{method:"PATCH",body:JSON.stringify({
    altText:String(formData.get("altText")||"").trim()||null,role:String(formData.get("role")||"gallery"),
    position:Number(formData.get("position")||0),mediaSetId:String(formData.get("mediaSetId")||"").trim()||null,
    focalX:Number(formData.get("focalX")||0.5),focalY:Number(formData.get("focalY")||0.5),
  })});
  revalidatePath("/products/"+productId);
}
export async function deleteMediaAction(productId:string,mediaId:string){
  await request("/v1/admin/media/"+encodeURIComponent(mediaId),{method:"DELETE"});
  revalidatePath("/products/"+productId);
}
