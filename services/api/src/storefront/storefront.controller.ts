import {Controller,Get,Param} from "@nestjs/common";
import {StorefrontService} from "./storefront.service";

@Controller("v1/storefront")
export class StorefrontController{
  constructor(private readonly storefront:StorefrontService){}
  @Get("products") products(){return this.storefront.products();}
  @Get("products/:handle") product(@Param("handle") handle:string){return this.storefront.product(handle);}
  @Get("collections") collections(){return this.storefront.collections();}
  @Get("config") config(){return this.storefront.config();}
}
