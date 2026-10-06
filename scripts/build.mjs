import {spawnSync} from "node:child_process";

const api=process.env.APP_RUNTIME==="api";
const command=process.platform==="win32"?"npm.cmd":"npm";
const args=["run",api?"build:api":"build:web"];
console.log(`[build] runtime=${api?"api":"web"}`);
const result=spawnSync(command,args,{stdio:"inherit",env:process.env});
process.exit(result.status??1);
