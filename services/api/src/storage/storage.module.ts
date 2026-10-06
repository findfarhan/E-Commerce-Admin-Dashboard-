import {Global,Module} from "@nestjs/common";
import {CloudflareR2Storage} from "./cloudflare-r2.storage";
import {SourceUrlStorage} from "./source-url.storage";
import {OBJECT_STORAGE} from "./storage.port";

@Global()
@Module({
  providers:[
    CloudflareR2Storage,
    SourceUrlStorage,
    {
      provide:OBJECT_STORAGE,
      useFactory:(cloudflare:CloudflareR2Storage,sourceUrl:SourceUrlStorage)=>{
        const provider=(process.env.MEDIA_STORAGE_PROVIDER||"source-url").toLowerCase();
        if(provider==="source-url"||provider==="deferred") return sourceUrl;
        if(provider==="cloudflare-r2") return cloudflare;
        throw new Error("Unsupported MEDIA_STORAGE_PROVIDER: "+provider);
      },
      inject:[CloudflareR2Storage,SourceUrlStorage],
    },
  ],
  exports:[OBJECT_STORAGE,CloudflareR2Storage,SourceUrlStorage],
})
export class StorageModule{}
