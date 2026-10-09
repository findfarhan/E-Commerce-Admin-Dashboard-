import {Module} from "@nestjs/common";
import {AffiliatesService} from "./affiliates.service";
import {AffiliateAccountController,AffiliateAdminController,AffiliatePublicController} from "./affiliates.controller";
import {StorefrontAccountsModule} from "../storefront-accounts/storefront-accounts.module";

@Module({
  imports:[StorefrontAccountsModule],
  providers:[AffiliatesService],
  controllers:[AffiliatePublicController,AffiliateAccountController,AffiliateAdminController],
})
export class AffiliatesModule{}
