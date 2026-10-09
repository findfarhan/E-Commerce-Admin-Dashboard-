import {Body,Controller,Delete,Get,Param,Patch,Post,UseGuards} from "@nestjs/common";
import {AdminKeyGuard} from "../common/admin-key.guard";
import {PublicRateLimitGuard} from "../common/public-rate-limit.guard";
import {BundlesService} from "./bundles.service";

@Controller("v1/admin/bundles")
@UseGuards(AdminKeyGuard)
export class AdminBundlesController{
  constructor(private readonly bundles:BundlesService){}
  @Get() list(){return this.bundles.listAdmin();}
  @Get("variants") variants(){return this.bundles.variantChoices();}
  @Get(":id") detail(@Param("id") id:string){return this.bundles.detailAdmin(id);}
  @Post() create(@Body() body:any){return this.bundles.create(body);}
  @Patch(":id") update(@Param("id") id:string,@Body() body:any){return this.bundles.update(id,body);}
  @Delete(":id") archive(@Param("id") id:string){return this.bundles.archive(id);}
}
@Controller("v1/storefront/bundles")
@UseGuards(PublicRateLimitGuard)
export class PublicBundlesController{
  constructor(private readonly bundles:BundlesService){}
  @Get() list(){return this.bundles.listPublic();}
}
