import {Body,Controller,Get,Param,Post,Query,UseGuards} from "@nestjs/common";
import {PublicRateLimitGuard} from "../common/public-rate-limit.guard";
import {StorefrontService} from "./storefront.service";

@Controller("v1/storefront")
@UseGuards(PublicRateLimitGuard)
export class StorefrontController{
  constructor(private readonly storefront:StorefrontService){}
  @Get("products") products(){return this.storefront.products();}
  @Get("products/:handle") product(@Param("handle") handle:string){return this.storefront.product(handle);}
  @Get("collections") collections(){return this.storefront.collections();}
  @Get("collections/:handle") collection(@Param("handle") handle:string){return this.storefront.collection(handle);}
  @Get("search") search(@Query("q") q:string){return this.storefront.search(q);}
  @Get("redirect") redirect(@Query("path") path:string){return this.storefront.redirect(path);}
  @Post("order-lookup") orderLookup(@Body() body:any){return this.storefront.orderLookup(body);}
  @Get("config") config(){return this.storefront.config();}
}
