import {Global,Module} from "@nestjs/common";
import {CloudflareR2Storage} from "./cloudflare-r2.storage";
import {OBJECT_STORAGE} from "./storage.port";

@Global()
@Module({
  providers:[
    CloudflareR2Storage,
    {
      provide:OBJECT_STORAGE,
      useFactory:(cloudflare:CloudflareR2Storage)=>{
        const provider=(process.env.MEDIA_STORAGE_PROVIDER||"cloudflare-r2").toLowerCase();
        if(provider!=="cloudflare-r2"){
          throw new Error("Unsupported MEDIA_STORAGE_PROVIDER: "+provider);
        }
        return cloudflare;
      },
      inject:[CloudflareR2Storage],
    },
  ],
  exports:[OBJECT_STORAGE,CloudflareR2Storage],
})
export class StorageModule{}
