export const OBJECT_STORAGE = Symbol("OBJECT_STORAGE");

export type ObjectMetadata = {
  contentLength?: number;
  contentType?: string;
};

export interface ObjectStorage {
  readonly provider: string;
  createSignedUploadUrl(key:string,contentType:string,expiresInSeconds:number):Promise<string>;
  head(key:string):Promise<ObjectMetadata>;
  getBuffer(key:string):Promise<Buffer>;
  put(key:string,body:Buffer,contentType:string):Promise<void>;
  delete(key:string):Promise<void>;
  publicUrl(key:string):string|null;
}
