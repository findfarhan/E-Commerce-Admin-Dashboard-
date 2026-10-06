import {Body,Controller,Delete,Get,Param,Patch,Post,Put,UseGuards} from "@nestjs/common";
import {AdminKeyGuard} from "../common/admin-key.guard";
import {CollectionsService} from "./collections.service";

@Controller("v1/admin/collections")
@UseGuards(AdminKeyGuard)
export class CollectionsController{
  constructor(private readonly collections:CollectionsService){}
  @Get() list(){return this.collections.list();}
  @Get(":id") detail(@Param("id") id:string){return this.collections.detail(id);}
  @Post() create(@Body() body:any){return this.collections.create(body);}
  @Patch(":id") update(@Param("id") id:string,@Body() body:any){return this.collections.update(id,body);}
  @Put(":id/products") products(@Param("id") id:string,@Body() body:any){return this.collections.setProducts(id,body);}
  @Delete(":id") archive(@Param("id") id:string){return this.collections.archive(id);}
}
