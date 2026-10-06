import {Injectable,ServiceUnavailableException} from "@nestjs/common";
import {GetObjectCommand,HeadObjectCommand,PutObjectCommand,S3Client} from "@aws-sdk/client-s3";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";

@Injectable()
export class R2Service{
  private client:S3Client|null=null;

  private config(){
    const accountId=process.env.CLOUDFLARE_ACCOUNT_ID;
    const bucket=process.env.R2_BUCKET_NAME;
    const accessKeyId=process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey=process.env.R2_SECRET_ACCESS_KEY;
    if(!accountId||!bucket||!accessKeyId||!secretAccessKey) throw new ServiceUnavailableException("Cloudflare R2 is not configured");
    if(!this.client){
      this.client=new S3Client({region:"auto",endpoint:"https://"+accountId+".r2.cloudflarestorage.com",credentials:{accessKeyId,secretAccessKey}});
    }
    return {bucket,client:this.client};
  }

  async signedPut(key:string,contentType:string){
    const {bucket,client}=this.config();
    const command=new PutObjectCommand({Bucket:bucket,Key:key,ContentType:contentType});
    return getSignedUrl(client,command,{expiresIn:Number(process.env.R2_UPLOAD_URL_TTL_SECONDS||900)});
  }

  async head(key:string){
    const {bucket,client}=this.config();
    return client.send(new HeadObjectCommand({Bucket:bucket,Key:key}));
  }

  async getBuffer(key:string){
    const {bucket,client}=this.config();
    const response=await client.send(new GetObjectCommand({Bucket:bucket,Key:key}));
    if(!response.Body) throw new Error("R2 object has no body");
    const bytes=await (response.Body as any).transformToByteArray();
    return Buffer.from(bytes);
  }

  async put(key:string,body:Buffer,contentType:string){
    const {bucket,client}=this.config();
    await client.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:body,ContentType:contentType,CacheControl:"public, max-age=31536000, immutable"}));
  }
}
