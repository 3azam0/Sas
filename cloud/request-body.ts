/** Bound bytes while streaming, including requests without Content-Length. */
export async function limitedText(request:Request,limit:number):Promise<string|null>{
 if(Number(request.headers.get('Content-Length')??0)>limit)return null;
 if(!request.body)return '';
 const reader=request.body.getReader(),decoder=new TextDecoder();let size=0,text='';
 try{while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>limit){await reader.cancel();return null;}text+=decoder.decode(chunk.value,{stream:true});}return text+decoder.decode();}finally{reader.releaseLock();}
}
