import {Body,Controller,Get,Param,Post,Query,UseGuards} from "@nestjs/common";
import {AdminKeyGuard} from "../common/admin-key.guard";
import {CommerceService} from "./commerce.service";

@Controller("v1/admin/commerce")
@UseGuards(AdminKeyGuard)
export class CommerceController{
  constructor(private readonly commerce:CommerceService){}
  @Get("overview") overview(){return this.commerce.overview();}
  @Get("order-catalog") orderCatalog(){return this.commerce.orderCatalog();}
  @Get("locations") locations(){return this.commerce.locations();}
  @Post("locations") createLocation(@Body() b:any){return this.commerce.createLocation(b);}
  @Post("locations/:locationId/variants/:variantId/adjust") adjust(@Param("locationId") l:string,@Param("variantId") v:string,@Body() b:any){return this.commerce.adjustLocationStock(l,v,b);}
  @Get("metafield-definitions") defs(@Query("resourceType") t?:string){return this.commerce.metafieldDefinitions(t||"product");}
  @Post("metafield-definitions") createDef(@Body() b:any){return this.commerce.createMetafieldDefinition(b);}
  @Get("metafields/:resourceType/:resourceId") metafields(@Param("resourceType") t:string,@Param("resourceId") id:string){return this.commerce.metafields(t,id);}
  @Post("metafields/:resourceType/:resourceId") upsertMetafield(@Param("resourceType") t:string,@Param("resourceId") id:string,@Body() b:any){return this.commerce.upsertMetafield(t,id,b);}
  @Get("discounts") discounts(){return this.commerce.discounts();}
  @Post("discounts") createDiscount(@Body() b:any){return this.commerce.createDiscount(b);}
  @Get("shipping") shipping(){return this.commerce.shipping();}
  @Post("shipping/zones") shippingZone(@Body() b:any){return this.commerce.createShippingZone(b);}
  @Get("taxes") taxes(){return this.commerce.taxes();}
  @Post("taxes") tax(@Body() b:any){return this.commerce.createTaxRule(b);}
  @Post("orders") manualOrder(@Body() b:any){return this.commerce.createManualOrder(b);}
  @Post("orders/:id/edit") editOrder(@Param("id") id:string,@Body() b:any){return this.commerce.editOrder(id,b);}
  @Get("draft-orders") drafts(){return this.commerce.drafts();}
  @Post("draft-orders") createDraft(@Body() b:any){return this.commerce.createDraft(b);}
  @Post("draft-orders/:id/convert") convertDraft(@Param("id") id:string,@Body() b:any){return this.commerce.convertDraft(id,b);}
  @Get("payments") payments(@Query("orderId") id?:string){return this.commerce.payments(id);}
  @Post("orders/:id/payments") payment(@Param("id") id:string,@Body() b:any){return this.commerce.recordPayment(id,b);}
  @Get("returns") returns(){return this.commerce.returns();}
  @Post("returns") createReturn(@Body() b:any){return this.commerce.createReturn(b);}
  @Post("returns/:id/complete") completeReturn(@Param("id") id:string,@Body() b:any){return this.commerce.completeReturn(id,b);}
  @Get("customers/:id/addresses") addresses(@Param("id") id:string){return this.commerce.customerAddresses(id);}
  @Post("customers/:id/addresses") address(@Param("id") id:string,@Body() b:any){return this.commerce.addCustomerAddress(id,b);}
  @Get("suppliers") suppliers(){return this.commerce.suppliers();}
  @Post("suppliers") supplier(@Body() b:any){return this.commerce.createSupplier(b);}
  @Get("purchase-orders") purchaseOrders(){return this.commerce.purchaseOrders();}
  @Post("purchase-orders") purchaseOrder(@Body() b:any){return this.commerce.createPurchaseOrder(b);}
  @Post("purchase-orders/:id/receive") receive(@Param("id") id:string){return this.commerce.receivePurchaseOrder(id);}
  @Get("audit") audit(){return this.commerce.audit();}
  @Get("notifications") notifications(){return this.commerce.notifications();}
  @Get("report") report(){return this.commerce.report();}
}
