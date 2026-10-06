import {Body,Controller,Get,Param,Patch,Post,UseGuards} from "@nestjs/common";
import {AdminKeyGuard} from "../common/admin-key.guard";
import {ProductsService} from "./products.service";

@Controller("v1/admin/products")
@UseGuards(AdminKeyGuard)
export class ProductsController{
  constructor(private readonly products:ProductsService){}
  @Get() list(){return this.products.listAdmin();}
  @Get(":id") detail(@Param("id") id:string){return this.products.getAdminDetail(id);}
  @Post() create(@Body() body:any){return this.products.createProduct(body);}
  @Patch(":id") update(@Param("id") id:string,@Body() body:any){return this.products.updateProduct(id,body);}
  @Post(":id/options") createOption(@Param("id") id:string,@Body() body:any){return this.products.createOption(id,body);}
  @Post(":id/variants") createVariant(@Param("id") id:string,@Body() body:any){return this.products.createVariant(id,body);}
  @Post(":id/media-sets") createMediaSet(@Param("id") id:string,@Body() body:any){return this.products.createMediaSet(id,body);}
}
