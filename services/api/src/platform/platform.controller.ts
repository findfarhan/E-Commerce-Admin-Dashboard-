import {Body,Controller,Delete,Get,Param,Patch,Post,Put,Query,UseGuards} from "@nestjs/common";
import {AdminKeyGuard} from "../common/admin-key.guard";
import {CatalogPlatformService} from "./catalog-platform.service";
import {CrmPlatformService} from "./crm-platform.service";
import {FulfillmentPlatformService} from "./fulfillment-platform.service";
import {GovernanceService} from "./governance.service";
import {OrdersPlatformService} from "./orders-platform.service";
import {ProcurementPlatformService} from "./procurement-platform.service";

@Controller("v1/admin")
@UseGuards(AdminKeyGuard)
export class PlatformController{
  constructor(
    private readonly catalog:CatalogPlatformService,
    private readonly crm:CrmPlatformService,
    private readonly fulfillment:FulfillmentPlatformService,
    private readonly governance:GovernanceService,
    private readonly orders:OrdersPlatformService,
    private readonly procurement:ProcurementPlatformService,
  ){}

  @Get("metafield-definitions") metafieldDefinitions(@Query("ownerType") ownerType?:string){return this.catalog.metafieldDefinitions(ownerType);}
  @Post("metafield-definitions") createMetafieldDefinition(@Body() body:any){return this.catalog.createMetafieldDefinition(body);}
  @Get("metafields/:ownerType/:ownerId") metafields(@Param("ownerType") ownerType:string,@Param("ownerId") ownerId:string){return this.catalog.metafields(ownerType,ownerId);}
  @Put("metafields/:ownerType/:ownerId") setMetafields(@Param("ownerType") ownerType:string,@Param("ownerId") ownerId:string,@Body() body:any){return this.catalog.setMetafields(ownerType,ownerId,body);}
  @Patch("products/:id/organization") productOrganization(@Param("id") id:string,@Body() body:any){return this.catalog.updateProductOrganization(id,body);}
  @Patch("variants/:id/cost") variantCost(@Param("id") id:string,@Body() body:any){return this.catalog.setVariantCost(id,body);}
  @Get("collections/:id/rules") collectionRules(@Param("id") id:string){return this.catalog.smartCollectionRules(id);}
  @Put("collections/:id/rules") setCollectionRules(@Param("id") id:string,@Body() body:any){return this.catalog.setSmartCollectionRules(id,body);}
  @Post("collections/:id/refresh") refreshCollection(@Param("id") id:string){return this.catalog.refreshSmartCollection(id);}
  @Patch("collections/:id/schedule") scheduleCollection(@Param("id") id:string,@Body() body:any){return this.catalog.scheduleCollection(id,body);}

  @Get("draft-orders") draftOrders(){return this.orders.draftOrders();}
  @Post("draft-orders") createDraft(@Body() body:any){return this.orders.createDraft(body);}
  @Get("draft-orders/:id") draftOrder(@Param("id") id:string){return this.orders.draftOrder(id);}
  @Patch("draft-orders/:id") updateDraft(@Param("id") id:string,@Body() body:any){return this.orders.updateDraft(id,body);}
  @Post("draft-orders/:id/send") sendDraft(@Param("id") id:string,@Body() body:any){return this.orders.sendDraft(id,body);}
  @Post("draft-orders/:id/convert") convertDraft(@Param("id") id:string,@Body() body:any){return this.orders.convertDraft(id,body);}
  @Post("manual-orders") manualOrder(@Body() body:any){return this.orders.manualOrder(body);}
  @Patch("order-editor/:id") editOrder(@Param("id") id:string,@Body() body:any){return this.orders.editOrder(id,body);}

  @Get("discounts") discounts(){return this.fulfillment.discounts();}
  @Post("discounts") createDiscount(@Body() body:any){return this.fulfillment.createDiscount(body);}
  @Patch("discounts/:id") updateDiscount(@Param("id") id:string,@Body() body:any){return this.fulfillment.updateDiscount(id,body);}
  @Get("shipping") shipping(){return this.fulfillment.shipping();}
  @Post("shipping/zones") createShippingZone(@Body() body:any){return this.fulfillment.createShippingZone(body);}
  @Post("shipping/zones/:id/rates") createShippingRate(@Param("id") id:string,@Body() body:any){return this.fulfillment.createShippingRate(id,body);}
  @Get("taxes") taxes(){return this.fulfillment.taxes();}
  @Post("taxes") createTax(@Body() body:any){return this.fulfillment.createTaxRule(body);}
  @Patch("taxes/mode") taxMode(@Body() body:any){return this.fulfillment.setPricesIncludeTax(Boolean(body?.pricesIncludeTax));}
  @Get("locations") locations(){return this.fulfillment.locations();}
  @Post("locations") createLocation(@Body() body:any){return this.fulfillment.createLocation(body);}
  @Get("inventory-levels") inventory(@Query("locationId") locationId?:string){return this.fulfillment.inventory(locationId);}
  @Post("locations/:locationId/inventory/:variantId/adjust") adjustInventory(@Param("locationId") locationId:string,@Param("variantId") variantId:string,@Body() body:any){return this.fulfillment.adjustInventory(locationId,variantId,body);}
  @Post("inventory-transfers") createTransfer(@Body() body:any){return this.fulfillment.createTransfer(body);}
  @Post("inventory-transfers/:id/receive") receiveTransfer(@Param("id") id:string,@Body() body:any){return this.fulfillment.receiveTransfer(id,body);}
  @Get("payments") payments(@Query("orderId") orderId?:string){return this.fulfillment.payments(orderId);}
  @Post("payments") recordPayment(@Body() body:any){return this.fulfillment.recordPayment(body);}
  @Post("payments/refund") refundPayment(@Body() body:any){return this.fulfillment.refundPayment(body);}
  @Get("returns") returns(){return this.fulfillment.returns();}
  @Post("returns") createReturn(@Body() body:any){return this.fulfillment.createReturn(body);}
  @Post("returns/:id/complete") completeReturn(@Param("id") id:string,@Body() body:any){return this.fulfillment.completeReturn(id,body);}

  @Get("customers/:id/profile") customerProfile(@Param("id") id:string){return this.crm.customerProfile(id);}
  @Post("customers/:id/addresses") addAddress(@Param("id") id:string,@Body() body:any){return this.crm.addAddress(id,body);}
  @Patch("customers/:id/addresses/:addressId") updateAddress(@Param("id") id:string,@Param("addressId") addressId:string,@Body() body:any){return this.crm.updateAddress(id,addressId,body);}
  @Delete("customers/:id/addresses/:addressId") deleteAddress(@Param("id") id:string,@Param("addressId") addressId:string){return this.crm.deleteAddress(id,addressId);}
  @Put("customers/:id/tags") setCustomerTags(@Param("id") id:string,@Body() body:any){return this.crm.setTags(id,body);}

  @Get("suppliers") suppliers(){return this.procurement.suppliers();}
  @Post("suppliers") createSupplier(@Body() body:any){return this.procurement.createSupplier(body);}
  @Get("purchase-orders") purchaseOrders(){return this.procurement.purchaseOrders();}
  @Post("purchase-orders") createPurchaseOrder(@Body() body:any){return this.procurement.createPurchaseOrder(body);}
  @Get("purchase-orders/:id") purchaseOrder(@Param("id") id:string){return this.procurement.purchaseOrder(id);}
  @Post("purchase-orders/:id/order") orderPurchaseOrder(@Param("id") id:string,@Body() body:any){return this.procurement.orderPurchaseOrder(id,body);}
  @Post("purchase-orders/:id/receive") receivePurchaseOrder(@Param("id") id:string,@Body() body:any){return this.procurement.receivePurchaseOrder(id,body);}

  @Post("auth/bootstrap") bootstrapAdmin(@Body() body:any){return this.governance.bootstrapAdmin(body);}
  @Post("auth/login") login(@Body() body:any){return this.governance.login(body);}
  @Post("auth/users") createAdminUser(@Body() body:any){return this.governance.createAdminUser(body);}
  @Patch("auth/users/:id") updateAdminUser(@Param("id") id:string,@Body() body:any){return this.governance.updateAdminUser(id,body);}

  @Get("audit-logs") auditLogs(@Query("limit") limit?:string){return this.governance.logs(Number(limit||200));}
  @Get("notifications") notifications(@Query("status") status?:string){return this.governance.notifications(status);}
  @Patch("notifications/:id") notification(@Param("id") id:string,@Body() body:any){return this.governance.markNotification(id,String(body?.status||"read"));}
  @Get("roles") roles(){return this.governance.roles();}
  @Post("roles") createRole(@Body() body:any){return this.governance.createRole(body);}
  @Get("outbox") outbox(){return this.governance.outbox();}
}
