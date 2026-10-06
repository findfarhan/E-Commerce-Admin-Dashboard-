export function eventKey(provider:string,storeId:string,externalEventId:string){
  return [provider,storeId,externalEventId].join(":");
}
