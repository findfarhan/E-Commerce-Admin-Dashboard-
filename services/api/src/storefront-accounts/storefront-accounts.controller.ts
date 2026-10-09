import {Body,Controller,Delete,Get,Headers,Param,Patch,Post,UseGuards} from "@nestjs/common";
import {PublicRateLimitGuard} from "../common/public-rate-limit.guard";
import {StorefrontAccountsService} from "./storefront-accounts.service";

@Controller("v1/storefront/account")
@UseGuards(PublicRateLimitGuard)
export class StorefrontAccountsController{
  constructor(private readonly accounts:StorefrontAccountsService){}
  private token(header?:string){
    const match=/^Bearer ([A-Za-z0-9_-]{25,200})$/i.exec(String(header||""));
    return match?.[1];
  }
  @Post("register") register(@Body() body:any){return this.accounts.register(body);}
  @Post("login") login(@Body() body:any){return this.accounts.login(body);}
  @Post("logout") logout(@Headers("authorization") auth?:string){return this.accounts.logout(this.token(auth));}
  @Get("me") me(@Headers("authorization") auth?:string){return this.accounts.me(this.token(auth));}
  @Patch("profile") profile(@Headers("authorization") auth:string,@Body() body:any){return this.accounts.profile(this.token(auth),body);}
  @Post("change-password") changePassword(@Headers("authorization") auth:string,@Body() body:any){return this.accounts.changePassword(this.token(auth),body);}
  @Get("addresses") addresses(@Headers("authorization") auth:string){return this.accounts.addresses(this.token(auth));}
  @Post("addresses") createAddress(@Headers("authorization") auth:string,@Body() body:any){return this.accounts.saveAddress(this.token(auth),body);}
  @Patch("addresses/:id") updateAddress(@Headers("authorization") auth:string,@Param("id") id:string,@Body() body:any){return this.accounts.saveAddress(this.token(auth),body,id);}
  @Delete("addresses/:id") deleteAddress(@Headers("authorization") auth:string,@Param("id") id:string){return this.accounts.deleteAddress(this.token(auth),id);}
  @Get("orders") orders(@Headers("authorization") auth:string){return this.accounts.orders(this.token(auth));}
  @Post("claim-order") claimOrder(@Headers("authorization") auth:string,@Body() body:any){return this.accounts.claimOrder(this.token(auth),body);}
  @Get("reviews/:handle") publicReviews(@Param("handle") handle:string){return this.accounts.publicReviews(handle);}
  @Post("reviews/:handle") postReview(@Headers("authorization") auth:string,@Param("handle") handle:string,@Body() body:any){return this.accounts.postReview(this.token(auth),handle,body);}
}
