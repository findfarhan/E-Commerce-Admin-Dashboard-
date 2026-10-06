import {Injectable,ServiceUnavailableException} from "@nestjs/common";
import type {ObjectMetadata,ObjectStorage} from "./storage.port";

@Injectable()
export class SourceUrlStorage implements ObjectStorage{
  readonly provider="source-url";

  private unavailable():never{
    throw new ServiceUnavailableException("Managed media uploads are deferred. Existing source URLs remain available.");
  }

  async createSignedUploadUrl(_key:string,_contentType:string,_expiresInSeconds:number):Promise<string>{
    return this.unavailable();
  }

  async head(_key:string):Promise<ObjectMetadata>{
    return this.unavailable();
  }

  async getBuffer(_key:string):Promise<Buffer>{
    return this.unavailable();
  }

  async put(_key:string,_body:Buffer,_contentType:string):Promise<void>{
    return this.unavailable();
  }

  async delete(_key:string):Promise<void>{
    return;
  }

  publicUrl(_key:string){
    return null;
  }
}
