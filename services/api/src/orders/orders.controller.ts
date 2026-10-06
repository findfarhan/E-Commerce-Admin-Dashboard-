import {Controller,Get,Param,UseGuards} from "@nestjs/common";
import {AdminKeyGuard} from "../common/admin-key.guard";
import {OrdersService} from "./orders.service";

@Controller("v1/admin/orders")
@UseGuards(AdminKeyGuard)
export class OrdersController{
  constructor(private readonly orders:OrdersService){}
  @Get() list(){return this.orders.list();}
  @Get(":id") detail(@Param("id") id:string){return this.orders.detail(id);}
}
