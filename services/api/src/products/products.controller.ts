import {Body,Controller,Delete,Get,Param,Patch,Post,Query,UseGuards} from "@nestjs/common";
import {AdminKeyGuard} from "../common/admin-key.guard";
import {ProductsService} from "./products.service";

@Controller("v1/admin/products")
@UseGuards(AdminKeyGuard)
export class ProductsController{
  constructor(private readonly products:ProductsService){}
  @Get() list(@Query() query:any){return this.products.listAdmin(query);}
  @Get(":id") detail(@Param("id") id:string){return this.products.getAdminDetail(id);}
  @Post() create(@Body() body:any){return this.products.createProduct(body);}
  @Patch(":id") update(@Param("id") id:string,@Body() body:any){return this.products.updateProduct(id,body);}
  @Post(":id/duplicate") duplicateProduct(@Param("id") id:string){return this.products.duplicateProduct(id);}
  @Delete(":id") archive(@Param("id") id:string){return this.products.archiveProduct(id);}

  @Post(":id/options") createOption(@Param("id") id:string,@Body() body:any){return this.products.createOption(id,body);}
  @Patch(":id/options/:optionId") updateOption(@Param("id") id:string,@Param("optionId") optionId:string,@Body() body:any){return this.products.updateOption(id,optionId,body);}
  @Delete(":id/options/:optionId") deleteOption(@Param("id") id:string,@Param("optionId") optionId:string){return this.products.deleteOption(id,optionId);}

  @Post(":id/variants") createVariant(@Param("id") id:string,@Body() body:any){return this.products.createVariant(id,body);}
  @Post(":id/variants/generate") generateVariants(@Param("id") id:string,@Body() body:any){return this.products.generateVariants(id,body);}
  @Patch(":id/variants/:variantId") updateVariant(@Param("id") id:string,@Param("variantId") variantId:string,@Body() body:any){return this.products.updateVariant(id,variantId,body);}
  @Delete(":id/variants/:variantId") archiveVariant(@Param("id") id:string,@Param("variantId") variantId:string){return this.products.archiveVariant(id,variantId);}

  @Post(":id/media-sets") createMediaSet(@Param("id") id:string,@Body() body:any){return this.products.createMediaSet(id,body);}
}
