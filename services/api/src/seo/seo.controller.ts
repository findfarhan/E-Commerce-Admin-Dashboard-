import {Body,Controller,Get,Param,Put,UseGuards} from "@nestjs/common";
import {AdminKeyGuard} from "../common/admin-key.guard";
import {SeoService} from "./seo.service";

@Controller("v1/admin/seo")
@UseGuards(AdminKeyGuard)
export class SeoController{
  constructor(private readonly seo:SeoService){}
  @Get(":resourceType/:resourceId") get(@Param("resourceType") type:string,@Param("resourceId") id:string){return this.seo.get(type,id);}
  @Put(":resourceType/:resourceId") upsert(@Param("resourceType") type:string,@Param("resourceId") id:string,@Body() body:any){return this.seo.upsert(type,id,body);}
}
