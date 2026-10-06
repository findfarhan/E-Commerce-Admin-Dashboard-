import {Body,Controller,Get,Param,Post,UseGuards} from "@nestjs/common";
import {AdminKeyGuard} from "../common/admin-key.guard";
import {InventoryService} from "./inventory.service";

@Controller("v1/admin/inventory")
@UseGuards(AdminKeyGuard)
export class InventoryController{
  constructor(private readonly inventory:InventoryService){}
  @Get("variants/:variantId/movements") movements(@Param("variantId") variantId:string){return this.inventory.movements(variantId);}
  @Post("variants/:variantId/adjust") adjust(@Param("variantId") variantId:string,@Body() body:any){return this.inventory.adjust(variantId,body);}
}
