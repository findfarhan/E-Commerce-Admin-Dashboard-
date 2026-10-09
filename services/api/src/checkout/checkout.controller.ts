import {Body,Controller,Get,Headers,Param,Post,UseGuards} from "@nestjs/common";
import {PublicRateLimitGuard} from "../common/public-rate-limit.guard";
import {CheckoutService} from "./checkout.service";

@Controller("v1/storefront/checkout")
@UseGuards(PublicRateLimitGuard)
export class CheckoutController{
  constructor(private readonly checkout:CheckoutService){}

  @Post()
  create(@Body() body:any){return this.checkout.create(body);}

  @Get(":id")
  detail(@Param("id") id:string){return this.checkout.detail(id);}

  @Post(":id/customer")
  customer(@Param("id") id:string,@Body() body:any){return this.checkout.setCustomer(id,body);}

  @Post(":id/complete")
  complete(@Param("id") id:string,@Headers("idempotency-key") key:string|undefined,@Body() body:any){
    return this.checkout.complete(id,key,body);
  }
}
