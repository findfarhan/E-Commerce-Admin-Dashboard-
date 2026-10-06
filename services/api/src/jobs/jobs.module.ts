import {Module} from "@nestjs/common";
import {MediaModule} from "../media/media.module";
import {JobsService} from "./jobs.service";

@Module({imports:[MediaModule],providers:[JobsService]})
export class JobsModule{}
