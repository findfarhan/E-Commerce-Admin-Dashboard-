import {Body,Controller,Get,Param,Patch,Post,UseGuards} from "@nestjs/common";
import {AdminKeyGuard} from "../common/admin-key.guard";
import {OrdersService} from "./orders.service";

@Controller("v1/admin/orders")
@UseGuards(AdminKeyGuard)
export class OrdersController{
  constructor(private readonly orders:OrdersService){}
  @Get() list(){return this.orders.list();}
  @Get(":id") detail(@Param("id") id:string){return this.orders.detail(id);}
  @Patch(":id") update(@Param("id") id:string,@Body() body:any){return this.orders.update(id,body);}
  @Post(":id/cancel") cancel(@Param("id") id:string,@Body() body:any){return this.orders.cancel(id,body);}
}
