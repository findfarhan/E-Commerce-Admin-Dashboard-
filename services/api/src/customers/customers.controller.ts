import {Controller,Get,Param,UseGuards} from "@nestjs/common";
import {AdminKeyGuard} from "../common/admin-key.guard";
import {CustomersService} from "./customers.service";

@Controller("v1/admin/customers")
@UseGuards(AdminKeyGuard)
export class CustomersController{
  constructor(private readonly customers:CustomersService){}
  @Get() list(){return this.customers.list();}
  @Get(":id") detail(@Param("id") id:string){return this.customers.detail(id);}
}
