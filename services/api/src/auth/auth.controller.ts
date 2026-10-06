import {Body,Controller,Post} from "@nestjs/common";
import {AuthService} from "./auth.service";
@Controller("v1/admin/auth")
export class AuthController{
  constructor(private readonly auth:AuthService){}
  @Post("login") login(@Body() body:any){return this.auth.login(body);}
}
