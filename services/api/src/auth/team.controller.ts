import {Body,Controller,Get,Param,Patch,Post,UseGuards} from "@nestjs/common";
import {AdminKeyGuard} from "../common/admin-key.guard";
import {AuthService} from "./auth.service";
@Controller("v1/admin/team")
@UseGuards(AdminKeyGuard)
export class TeamController{
  constructor(private readonly auth:AuthService){}
  @Get("roles") roles(){return this.auth.roles();}
  @Get("users") users(){return this.auth.users();}
  @Post("users") create(@Body() body:any){return this.auth.createUser(body);}
  @Patch("users/:id") update(@Param("id") id:string,@Body() body:any){return this.auth.updateUser(id,body);}
}
