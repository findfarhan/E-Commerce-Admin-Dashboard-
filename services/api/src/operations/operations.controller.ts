import {Body,Controller,Get,Patch,UseGuards} from "@nestjs/common";
import {AdminKeyGuard} from "../common/admin-key.guard";
import {OperationsService} from "./operations.service";

@Controller("v1/admin/operations")
@UseGuards(AdminKeyGuard)
export class OperationsController{
  constructor(private readonly operations:OperationsService){}

  @Get("analytics") analytics(){return this.operations.analytics();}
  @Get("channels") channels(){return this.operations.channels();}
  @Get("inbox") inbox(){return this.operations.inbox();}
  @Get("automations") automations(){return this.operations.automations();}
  @Get("settings") settings(){return this.operations.settings();}
  @Patch("settings") updateSettings(@Body() body:any){return this.operations.updateSettings(body);}
  @Get("storefront") storefront(){return this.operations.storefront();}
  @Get("seo-overview") seoOverview(){return this.operations.seoOverview();}
}
