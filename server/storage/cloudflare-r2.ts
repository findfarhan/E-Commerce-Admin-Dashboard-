export type R2Config={
  accountId:string;
  bucket:string;
  accessKeyId:string;
  secretAccessKey:string;
  publicBaseUrl:string;
  uploadTtlSeconds:number;
};

export function masterObjectKey(storeId:string,productId:string,mediaId:string,extension:string){
  return ["masters",storeId,"products",productId,mediaId,"original."+extension].join("/");
}

export function renditionObjectKey(storeId:string,productId:string,mediaId:string,preset:string,format:string){
  return ["renditions",storeId,"products",productId,mediaId,preset+"."+format].join("/");
}

export function publicRenditionUrl(config:R2Config,key:string){
  return config.publicBaseUrl.replace(/\/$/,"")+"/"+key;
}

// Actual S3-compatible presigning belongs in the Render backend.
// This frontend repository intentionally contains no R2 secret credentials.
