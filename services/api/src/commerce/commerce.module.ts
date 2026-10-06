import {Module} from "@nestjs/common";
import {DatabaseModule} from "../database/database.module";
import {CommerceController} from "./commerce.controller";
import {CommerceService} from "./commerce.service";
@Module({imports:[DatabaseModule],controllers:[CommerceController],providers:[CommerceService],exports:[CommerceService]})
export class CommerceModule{}
