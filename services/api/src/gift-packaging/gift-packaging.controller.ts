import {Body,Controller,Delete,Get,Param,Patch,Post,UseGuards} from "@nestjs/common";
import {AdminKeyGuard} from "../common/admin-key.guard";
import {PublicRateLimitGuard} from "../common/public-rate-limit.guard";
import {GiftPackagingService} from "./gift-packaging.service";

@Controller("v1/admin/gift-packaging")
@UseGuards(AdminKeyGuard)
export class AdminGiftPackagingController{
 constructor(private readonly packaging:GiftPackagingService){}
 @Get() list(){return this.packaging.listAdmin();}
 @Post() create(@Body() body:any){return this.packaging.save(null,body);}
 @Patch(":id") update(@Param("id") id:string,@Body() body:any){return this.packaging.save(id,body);}
 @Delete(":id") archive(@Param("id") id:string){return this.packaging.archive(id);}
}

@Controller("v1/storefront/gift-packaging")
@UseGuards(PublicRateLimitGuard)
export class PublicGiftPackagingController{
 constructor(private readonly packaging:GiftPackagingService){}
 @Get() list(){return this.packaging.listPublic();}
}
