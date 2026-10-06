import {Body,Controller,Delete,Get,Param,Patch,Post,UseGuards} from "@nestjs/common";
import {AdminKeyGuard} from "../common/admin-key.guard";
import {MediaService} from "./media.service";

@Controller("v1/admin")
@UseGuards(AdminKeyGuard)
export class MediaController{
  constructor(private readonly media:MediaService){}
  @Post("products/:productId/media/source")
  source(@Param("productId") productId:string,@Body() body:any){return this.media.createSource(productId,body);}

  @Post("products/:productId/media/upload-url")
  upload(@Param("productId") productId:string,@Body() body:any){return this.media.createUpload(productId,body);}
  @Post("media/:mediaId/finalize")
  finalize(@Param("mediaId") mediaId:string){return this.media.finalize(mediaId);}
  @Patch("media/:mediaId")
  update(@Param("mediaId") mediaId:string,@Body() body:any){return this.media.update(mediaId,body);}
  @Delete("media/:mediaId")
  remove(@Param("mediaId") mediaId:string){return this.media.delete(mediaId);}
  @Get("media/:mediaId/renditions")
  renditions(@Param("mediaId") mediaId:string){return this.media.renditions(mediaId);}
}
