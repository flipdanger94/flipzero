import { getCurrentUser } from "@/lib/auth";
import { getClanRole } from "@/lib/clans";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request:Request,{params}:{params:Promise<{clanId:string}>}) {
  const user=await getCurrentUser();
  if(!user) return new Response("Требуется вход.",{status:401});
  const {clanId}=await params;
  if(!await getClanRole(user.id,clanId)) return new Response("Доступ только для участников клана.",{status:403});

  const encoder=new TextEncoder();
  let timer:ReturnType<typeof setInterval>|null=null;
  let lifetime:ReturnType<typeof setTimeout>|null=null;
  const stream=new ReadableStream({
    start(controller){
      const send=(event:string,data:string)=>controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      send("ready",JSON.stringify({clanId}));
      timer=setInterval(()=>{void (async()=>{
        try{
          const role=await getClanRole(user.id,clanId);
          if(!role){send("revoked","{}");controller.close();if(timer)clearInterval(timer);if(lifetime)clearTimeout(lifetime);return;}
          send("sync",JSON.stringify({at:Date.now()}));
        }catch{send("ping","{}")}
      })()},3000);
      lifetime=setTimeout(()=>{try{controller.close()}catch{}if(timer)clearInterval(timer)},55_000);
      request.signal.addEventListener("abort",()=>{if(timer)clearInterval(timer);if(lifetime)clearTimeout(lifetime);try{controller.close()}catch{}},{once:true});
    },
    cancel(){if(timer)clearInterval(timer);if(lifetime)clearTimeout(lifetime);}
  });
  return new Response(stream,{headers:{
    "content-type":"text/event-stream; charset=utf-8",
    "cache-control":"no-cache, no-transform",
    "connection":"keep-alive",
    "x-accel-buffering":"no",
  }});
}
