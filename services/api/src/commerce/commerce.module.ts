import {Module} from "@nestjs/common";
import {DatabaseModule} from "../database/database.module";
import {CommerceController} from "./commerce.controller";
import {CommerceService} from "./commerce.service";
import {CollectionsModule} from "../collections/collections.module";
@Module({imports:[DatabaseModule,CollectionsModule],controllers:[CommerceController],providers:[CommerceService],exports:[CommerceService]})
export class CommerceModule{}
