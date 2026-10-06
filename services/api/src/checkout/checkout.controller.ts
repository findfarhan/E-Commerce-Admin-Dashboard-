import {Body,Controller,Get,Param,Post} from "@nestjs/common";
import {CheckoutService} from "./checkout.service";

@Controller("v1/storefront/checkout")
export class CheckoutController{
  constructor(private readonly checkout:CheckoutService){}

  @Post()
  create(@Body() body:any){return this.checkout.create(body);}

  @Get(":id")
  detail(@Param("id") id:string){return this.checkout.detail(id);}

  @Post(":id/customer")
  customer(@Param("id") id:string,@Body() body:any){return this.checkout.setCustomer(id,body);}
}
