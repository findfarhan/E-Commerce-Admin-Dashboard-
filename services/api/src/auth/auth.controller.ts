import {Body,Controller,Post,UseGuards} from "@nestjs/common";
import {PublicRateLimitGuard} from "../common/public-rate-limit.guard";
import {AdminKeyGuard} from "../common/admin-key.guard";
import {AuthService} from "./auth.service";
@Controller("v1/admin/auth")
export class AuthController{
  constructor(private readonly auth:AuthService){}
  @Post("bootstrap")
  @UseGuards(AdminKeyGuard)
  bootstrap(@Body() body:any){return this.auth.bootstrapOwner(body);}

  @Post("login")
  @UseGuards(PublicRateLimitGuard)
  login(@Body() body:any){return this.auth.login(body);}
}
