import {Controller,Get,UseGuards} from "@nestjs/common";
import {AdminKeyGuard} from "../common/admin-key.guard";
import {DashboardService} from "./dashboard.service";

@Controller("v1/admin/dashboard")
@UseGuards(AdminKeyGuard)
export class DashboardController{
  constructor(private readonly dashboard:DashboardService){}
  @Get() summary(){return this.dashboard.summary();}
}
