import { readFile } from "node:fs/promises";
import postgres from "postgres";
if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL required");
const db=postgres(process.env.DATABASE_URL,{max:1});
try{
 const items=JSON.parse(await readFile(new URL("../config/cosmetics.json",import.meta.url),"utf8"));
 for(const item of items){await db`INSERT INTO cosmetic_items(id,title,description,category,rarity,price,preview,superflip_only) VALUES(${item.id},${item.title},${item.description},${item.category},${item.rarity},${item.price},${item.preview},${item.superflipOnly}) ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,category=EXCLUDED.category,rarity=EXCLUDED.rarity,price=EXCLUDED.price,preview=EXCLUDED.preview,superflip_only=EXCLUDED.superflip_only`}
 const achievements=JSON.parse(await readFile(new URL("../config/achievements.json",import.meta.url),"utf8"));
 for(const item of achievements) await db`INSERT INTO achievement_definitions(id,space_id,key,name,description,icon,rarity,event_source,target,xp_reward,is_secret) VALUES(${item.id},NULL,${item.key},${item.name},${item.description},${item.icon},${item.rarity},${item.eventSource},${item.target},${item.xpReward},false) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,icon=EXCLUDED.icon,rarity=EXCLUDED.rarity,event_source=EXCLUDED.event_source,target=EXCLUDED.target,xp_reward=EXCLUDED.xp_reward`;
 console.log(`Синхронизировано ${items.length} предметов.`);
}finally{await db.end()}
