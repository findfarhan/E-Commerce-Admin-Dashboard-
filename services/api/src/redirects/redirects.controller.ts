import {Body,Controller,Delete,Get,Param,Post,UseGuards} from "@nestjs/common";
import {AdminKeyGuard} from "../common/admin-key.guard";
import {RedirectsService} from "./redirects.service";

@Controller("v1/admin/redirects")
@UseGuards(AdminKeyGuard)
export class RedirectsController{
  constructor(private readonly redirects:RedirectsService){}
  @Get() list(){return this.redirects.list();}
  @Post() create(@Body() body:any){return this.redirects.create(body);}
  @Delete(":id") remove(@Param("id") id:string){return this.redirects.remove(id);}
}
