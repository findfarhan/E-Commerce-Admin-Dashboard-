import {Injectable,NotFoundException} from "@nestjs/common";
import {DatabaseService} from "../database/database.service";

@Injectable()
export class StoreContextService{
  constructor(private readonly db:DatabaseService){}

  async store(){
    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    const result=await this.db.query<any>("select * from stores where domain=$1 limit 1",[domain]);
    if(!result.rowCount) throw new NotFoundException("Store is not configured for "+domain);
    return result.rows[0];
  }

  async storeId(){return (await this.store()).id as string;}
}
