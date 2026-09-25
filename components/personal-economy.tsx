"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Coins,
  Crown,
  Eye,
  Gift,
  LoaderCircle,
  PackageOpen,
  Search,
  ShoppingBag,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { CosmeticArt } from "./cosmetic-art";
import { MediaImage } from "./media-image";

type Ledger={id:string;amount:number;reason:string;createdAt:string};
type Quest={key:string;title:string;description:string;period:"daily"|"weekly";target:number;progress:number;coins:number;xp:number;claimed:boolean};
type ItemState="not_owned"|"owned"|"equipped";
type StoreItem={
  id:string;slug:string;title:string;description:string;category:string;type:string;slot:string;rarity:string;
  priceOrbs:number;priceMoneyCents:number|null;preview:string;previewImage:string|null;previewAnimation:string|null;
  superflipOnly:boolean;isBundle:boolean;isAnimated:boolean;isActive:boolean;isNew:boolean;state:ItemState;
  bundleItems:string[];createdAt:string;availableUntil:string|null;
};
type InventoryItem=StoreItem&{source:string;acquiredAt:string};
type StoreResponse={items:StoreItem[];balance:number;superflipActive:boolean;equipped:Record<string,string>;categories:string[];slots:string[];rarities:string[]};
type InventoryResponse={items:InventoryItem[];equipped:Record<string,string>;slots:string[]};
type Identity={displayName:string;avatarUrl?:string|null;bannerUrl?:string|null};

const slotLabels:Record<string,string>={
  avatar_decoration:"Рамка аватара",
  profile_effect:"Эффект профиля",
  profile_banner:"Баннер профиля",
  nameplate:"Стиль имени",
  chat_style:"Стиль сообщений",
  badge:"Значок",
  app_theme:"Тема приложения",
};
const categoryLabels:Record<string,string>={
  avatar_frame:"Рамки",
  profile_effect:"Эффекты профиля",
  banner:"Баннеры",
  nickname:"Стили имени",
  message_effect:"Сообщения",
  badge:"Значки",
  theme:"Темы",
  bundle:"Наборы",
};
const rarityLabels:Record<string,string>={common:"Обычный",rare:"Редкий",epic:"Эпический",legendary:"Легендарный",limited:"Лимитированный"};

function withEquippedState<T extends StoreItem>(items:T[],equipped:Record<string,string>){
  const equippedIds=new Set(Object.values(equipped));
  return items.map(item=>({...item,state:equippedIds.has(item.id)?"equipped":item.state==="not_owned"?"not_owned":"owned"} as T));
}

function ItemBadges({item}:{item:StoreItem}){
  return <div className="store-item-badges">
    {item.state==="owned"?<span className="owned"><Check size={11}/>Куплено</span>:null}
    {item.state==="equipped"?<span className="equipped"><Check size={11}/>Надето</span>:null}
    {item.isNew?<span>Новый</span>:null}
    {item.isBundle?<span>В наборе</span>:null}
    {item.isAnimated?<span className="animated"><Sparkles size={11}/>Анимированный</span>:null}
  </div>;
}

export function PersonalEconomy({onOpenSuperFlip}:{onOpenSuperFlip?:()=>void}={}){
  const [tab,setTab]=useState<"quests"|"store"|"inventory"|"history">("store");
  const [balance,setBalance]=useState(0);
  const [superflipActive,setSuperflipActive]=useState(false);
  const [ledger,setLedger]=useState<Ledger[]>([]);
  const [quests,setQuests]=useState<Quest[]>([]);
  const [streak,setStreak]=useState(0);
  const [identity,setIdentity]=useState<Identity|null>(null);
  const [storeItems,setStoreItems]=useState<StoreItem[]>([]);
  const [inventory,setInventory]=useState<InventoryResponse>({items:[],equipped:{},slots:[]});
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("all");
  const [sort,setSort]=useState("featured");
  const [inventoryQuery,setInventoryQuery]=useState("");
  const [inventorySlot,setInventorySlot]=useState("all");
  const [inventorySort,setInventorySort]=useState("newest");
  const [visibleLimit,setVisibleLimit]=useState(12);
  const [preview,setPreview]=useState<StoreItem|null>(null);
  const [hovered,setHovered]=useState("");

  const refresh=useCallback(async()=>{
    try{
      const [economyResponse,questResponse,storeResponse,inventoryResponse]=await Promise.all([
        fetch("/api/v1/economy",{cache:"no-store"}),
        fetch("/api/v1/quests",{cache:"no-store"}),
        fetch("/api/store?limit=100",{cache:"no-store"}),
        fetch("/api/inventory",{cache:"no-store"}),
      ]);
      if(!economyResponse.ok||!questResponse.ok||!storeResponse.ok||!inventoryResponse.ok)throw Error("Не удалось загрузить магазин.");
      const [economy,questData,store,inventoryData]=await Promise.all([
        economyResponse.json(),
        questResponse.json(),
        storeResponse.json() as Promise<StoreResponse>,
        inventoryResponse.json() as Promise<InventoryResponse>,
      ]);
      setBalance(economy.balance);
      setLedger(economy.transactions);
      setQuests(questData.quests);
      setStreak(questData.streak);
      setStoreItems(withEquippedState(store.items,inventoryData.equipped));
      setInventory({...inventoryData,items:withEquippedState(inventoryData.items,inventoryData.equipped)});
      setSuperflipActive(Boolean(store.superflipActive));
      setError("");
    }catch{
      setError("Не удалось загрузить данные. Повторите попытку.");
    }finally{
      setLoading(false);
    }
  },[]);

  useEffect(()=>{if(!preview)return;const handler=(event:KeyboardEvent)=>{if(event.key==="Escape")setPreview(null)};window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler)},[preview]);

  useEffect(()=>{
    const timer=window.setTimeout(()=>void refresh(),0);
    void fetch("/api/v1/auth/me",{cache:"no-store"})
      .then(response=>response.ok?response.json():null)
      .then(data=>{if(data?.user)setIdentity(data.user)})
      .catch(()=>undefined);
    return()=>window.clearTimeout(timer);
  },[refresh]);

  async function post(path:string,body:object){
    const response=await fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(data.message??"Действие не выполнено.");
    return data;
  }

  async function claimQuest(key:string){
    setBusy(key);setError("");
    try{await post("/api/v1/quests",{questKey:key});await refresh()}
    catch(reason){setError(reason instanceof Error?reason.message:"Не удалось забрать награду.")}
    finally{setBusy("")}
  }

  async function purchase(item:StoreItem){
    if(item.superflipOnly&&!superflipActive){setError("Для этого предмета нужен активный SuperFlip.");return}
    if(balance<item.priceOrbs){setError(`Не хватает ${item.priceOrbs-balance} Orbs.`);return}
    setBusy(item.id);setError("");
    try{await post("/api/store/purchase",{itemId:item.id});await refresh()}
    catch(reason){setError(reason instanceof Error?reason.message:"Покупка не выполнена.")}
    finally{setBusy("")}
  }

  async function equip(item:StoreItem){
    const previous=inventory;
    const nextEquipped={...inventory.equipped,[item.slot]:item.id};
    setInventory(current=>({...current,equipped:nextEquipped,items:withEquippedState(current.items,nextEquipped)}));
    setStoreItems(current=>withEquippedState(current,nextEquipped));
    setBusy(item.id);setError("");
    try{
      const data=await post("/api/inventory/equip",{itemId:item.id});
      if(data.inventory)setInventory({...data.inventory,items:withEquippedState(data.inventory.items,data.inventory.equipped)});
      if(item.slot==="app_theme")window.dispatchEvent(new Event("flipzero:preferences-updated"));
      await refresh();
    }catch(reason){
      setInventory(previous);
      setStoreItems(current=>withEquippedState(current,previous.equipped));
      setError(reason instanceof Error?reason.message:"Не удалось надеть предмет.");
    }finally{setBusy("")}
  }

  async function unequip(item:StoreItem){
    const previous=inventory;
    const nextEquipped={...inventory.equipped};
    delete nextEquipped[item.slot];
    setInventory(current=>({...current,equipped:nextEquipped,items:withEquippedState(current.items,nextEquipped)}));
    setStoreItems(current=>withEquippedState(current,nextEquipped));
    setBusy(item.id);setError("");
    try{
      const data=await post("/api/inventory/unequip",{slot:item.slot});
      if(data.inventory)setInventory({...data.inventory,items:withEquippedState(data.inventory.items,data.inventory.equipped)});
      if(item.slot==="app_theme")window.dispatchEvent(new Event("flipzero:preferences-updated"));
      await refresh();
    }catch(reason){
      setInventory(previous);
      setStoreItems(current=>withEquippedState(current,previous.equipped));
      setError(reason instanceof Error?reason.message:"Не удалось снять предмет.");
    }finally{setBusy("")}
  }

  const filteredStore=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase("ru");
    const rarityWeight:Record<string,number>={common:1,rare:2,epic:3,legendary:4,limited:5};
    return [...storeItems]
      .filter(item=>(category==="all"||item.category===category)&&(!q||item.title.toLocaleLowerCase("ru").includes(q)||item.description.toLocaleLowerCase("ru").includes(q)))
      .sort((a,b)=>{
        if(sort==="price_asc")return a.priceOrbs-b.priceOrbs;
        if(sort==="price_desc")return b.priceOrbs-a.priceOrbs;
        if(sort==="newest")return Number(b.isNew)-Number(a.isNew)||new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime();
        if(sort==="rarity")return (rarityWeight[b.rarity]??0)-(rarityWeight[a.rarity]??0);
        return Number(b.isBundle)-Number(a.isBundle)||Number(b.isAnimated)-Number(a.isAnimated)||a.priceOrbs-b.priceOrbs;
      });
  },[storeItems,query,category,sort]);

  const filteredInventory=useMemo(()=>{
    const q=inventoryQuery.trim().toLocaleLowerCase("ru");
    const rarityWeight:Record<string,number>={common:1,rare:2,epic:3,legendary:4,limited:5};
    return [...inventory.items]
      .filter(item=>(inventorySlot==="all"||item.slot===inventorySlot)&&(!q||item.title.toLocaleLowerCase("ru").includes(q)))
      .sort((a,b)=>{
        if(inventorySort==="name")return a.title.localeCompare(b.title,"ru");
        if(inventorySort==="rarity")return (rarityWeight[b.rarity]??0)-(rarityWeight[a.rarity]??0);
        return new Date(b.acquiredAt).getTime()-new Date(a.acquiredAt).getTime();
      });
  },[inventory.items,inventoryQuery,inventorySlot,inventorySort]);

  const featuredBundles=storeItems.filter(item=>item.isBundle).slice(0,2);
  const equippedItems=Object.entries(inventory.equipped).map(([slot,itemId])=>({slot,item:inventory.items.find(item=>item.id===itemId)??null}));
  const previewItem=preview?(storeItems.find(item=>item.id===preview.id)??inventory.items.find(item=>item.id===preview.id)??preview):null;

  function actionFor(item:StoreItem){
    if(item.isBundle){
      if(item.superflipOnly&&!superflipActive&&item.state==="not_owned")return <button onClick={()=>onOpenSuperFlip?onOpenSuperFlip():window.location.assign("/superflip")}>Нужен SuperFlip</button>;
      return <button disabled={!!busy||item.state!=="not_owned"} onClick={()=>void purchase(item)}>
        {busy===item.id?"Покупаем…":item.state!=="not_owned"?"Набор куплен":`Купить · ${item.priceOrbs} Orbs`}
      </button>;
    }
    if(item.state==="equipped")return <button className="secondary" disabled={!!busy} onClick={()=>void unequip(item)}>{busy===item.id?"Снимаем…":"Снять"}</button>;
    if(item.state==="owned")return <button disabled={!!busy} onClick={()=>void equip(item)}>{busy===item.id?"Надеваем…":"Надеть"}</button>;
    if(item.superflipOnly&&!superflipActive)return <button onClick={()=>onOpenSuperFlip?onOpenSuperFlip():window.location.assign("/superflip")}>Нужен SuperFlip</button>;
    return <button disabled={!!busy||balance<item.priceOrbs} onClick={()=>void purchase(item)}>
      {busy===item.id?"Покупаем…":balance<item.priceOrbs?`Не хватает ${item.priceOrbs-balance}`:`Купить · ${item.priceOrbs} Orbs`}
    </button>;
  }

  return <div className="personal-economy store-shell">
    <header className="store-shell-head">
      <div><small>FLIPZERO STYLE</small><h3>Магазин и коллекция</h3><p>Собирайте предметы, настраивайте профиль и меняйте стиль без перезагрузки.</p></div>
      <strong><Coins size={22}/>{balance.toLocaleString("ru-RU")} <small>Orbs</small></strong>
    </header>

    <nav className="store-main-tabs" aria-label="Экономика и косметика">
      <button className={tab==="store"?"active":""} onClick={()=>setTab("store")}><ShoppingBag size={17}/>Магазин</button>
      <button className={tab==="inventory"?"active":""} onClick={()=>setTab("inventory")}><PackageOpen size={17}/>Инвентарь</button>
      <button className={tab==="quests"?"active":""} onClick={()=>setTab("quests")}><Trophy size={17}/>Квесты</button>
      <button className={tab==="history"?"active":""} onClick={()=>setTab("history")}><Coins size={17}/>История</button>
    </nav>

    {error?<div role="alert" className="store-error">{error}<button type="button" onClick={()=>setError("")}><X size={15}/></button></div>:null}
    {loading?<div className="social-loading"><LoaderCircle className="spin"/>Загружаем коллекцию…</div>:null}

    {!loading&&tab==="store"?<div className="store-page">
      <section className="store-hero">
        <div>
          <span><Sparkles size={14}/> КОЛЛЕКЦИИ FLIPZERO</span>
          <h2>Найдите свой стиль.</h2>
          <p>Рамки, живые эффекты, баннеры, темы и наборы. Анимированные предметы запускаются при наведении и в предпросмотре.</p>
          <div><button onClick={()=>{setCategory("bundle");document.querySelector(".store-catalog")?.scrollIntoView({behavior:"smooth"})}}>Смотреть наборы</button><button className="ghost" onClick={()=>setTab("inventory")}>Моя коллекция</button></div>
        </div>
        <div className="store-hero-art" aria-hidden="true">
          <CosmeticArt live item={featuredBundles[0]??storeItems[0]??{title:"FlipZero",preview:"bundle-neon"}}/>
          <CosmeticArt live item={featuredBundles[1]??storeItems[1]??{title:"FlipZero",preview:"aurora-wave"}}/>
        </div>
      </section>

      {featuredBundles.length?<section className="store-featured">
        <div className="store-section-title"><div><small>ПОДБОРКА</small><h3>Наборы недели</h3></div><span>В одном наборе — несколько предметов для разных слотов.</span></div>
        <div className="store-featured-grid">{featuredBundles.map(item=><article key={item.id} className="store-feature-card">
          <CosmeticArt live={hovered===item.id} item={item}/>
          <div><ItemBadges item={item}/><small>{rarityLabels[item.rarity]??item.rarity}</small><h4>{item.title}</h4><p>{item.description}</p><strong>{item.priceOrbs} Orbs</strong><div className="store-card-actions"><button className="preview" onClick={()=>setPreview(item)}><Eye size={15}/>Просмотр</button>{actionFor(item)}</div></div>
        </article>)}</div>
      </section>:null}

      <section className="store-catalog">
        <div className="store-section-title"><div><small>МАГАЗИН</small><h3>Косметика</h3></div><span>{filteredStore.length} предметов</span></div>
        <div className="store-toolbar">
          <label className="store-search"><Search size={16}/><input value={query} onChange={event=>{setQuery(event.target.value);setVisibleLimit(12)}} placeholder="Поиск по магазину" aria-label="Поиск по магазину"/></label>
          <select value={sort} onChange={event=>setSort(event.target.value)} aria-label="Сортировка магазина">
            <option value="featured">Для вас</option><option value="newest">Сначала новые</option><option value="rarity">По редкости</option><option value="price_asc">Сначала дешевле</option><option value="price_desc">Сначала дороже</option>
          </select>
        </div>
        <div className="store-categories" aria-label="Категории">
          <button className={category==="all"?"active":""} onClick={()=>{setCategory("all");setVisibleLimit(12)}}>Все</button>
          {[...new Set(storeItems.map(item=>item.category))].map(value=><button key={value} className={category===value?"active":""} onClick={()=>{setCategory(value);setVisibleLimit(12)}}>{categoryLabels[value]??value}</button>)}
        </div>
        <div className="store-grid">{filteredStore.slice(0,visibleLimit).map(item=><article key={item.id} className={`store-item-card rarity-${item.rarity}`} onMouseEnter={()=>setHovered(item.id)} onMouseLeave={()=>setHovered("")} onFocus={()=>setHovered(item.id)} onBlur={()=>setHovered("")}>
          <div className="store-item-visual"><CosmeticArt live={hovered===item.id} item={item}/><ItemBadges item={item}/></div>
          <div className="store-item-copy"><small>{rarityLabels[item.rarity]??item.rarity} · {categoryLabels[item.category]??item.category}</small><h4>{item.title}</h4><p>{item.description}</p><div className="store-item-price"><strong>{item.priceOrbs} Orbs</strong>{item.superflipOnly?<span><Crown size={12}/>SuperFlip</span>:null}</div></div>
          <div className="store-card-actions"><button className="preview" onClick={()=>setPreview(item)}><Eye size={15}/>Просмотр</button>{actionFor(item)}</div>
        </article>)}</div>
        {visibleLimit<filteredStore.length?<div className="store-more"><span>Это ещё далеко не всё</span><button onClick={()=>setVisibleLimit(value=>value+16)}>Показать ещё предметы</button></div>:null}
        {!filteredStore.length?<div className="store-empty"><Search size={28}/><strong>Ничего не найдено</strong><p>Попробуйте другой запрос или категорию.</p></div>:null}
      </section>
    </div>:null}

    {!loading&&tab==="inventory"?<div className="inventory-page">
      <section className="inventory-equipped">
        <div className="store-section-title"><div><small>НАДЕТО</small><h3>Текущий образ</h3></div><span>Новый предмет автоматически заменяет старый в том же слоте.</span></div>
        <div className="equipped-slots">{(inventory.slots.length?inventory.slots:Object.keys(slotLabels)).filter(slot=>slot!=="bundle").map(slot=>{
          const current=equippedItems.find(entry=>entry.slot===slot)?.item??null;
          return <article key={slot} className={current?"filled":""}>
            <div className="equipped-slot-head"><span>{slotLabels[slot]??slot}</span>{current?<b>Надето</b>:null}</div>
            {current?<><CosmeticArt live item={current}/><strong>{current.title}</strong><button onClick={()=>void unequip(current)} disabled={!!busy}>Снять</button></>:<><div className="equipped-placeholder"><Sparkles size={24}/></div><strong>Слот свободен</strong><button onClick={()=>{setInventorySlot(slot);document.querySelector(".inventory-all")?.scrollIntoView({behavior:"smooth"})}}>Выбрать предмет</button></>}
          </article>;
        })}</div>
      </section>

      <section className="inventory-all">
        <div className="store-section-title"><div><small>КОЛЛЕКЦИЯ</small><h3>Все предметы</h3></div><span>{inventory.items.length} в коллекции</span></div>
        <div className="store-toolbar">
          <label className="store-search"><Search size={16}/><input value={inventoryQuery} onChange={event=>setInventoryQuery(event.target.value)} placeholder="Поиск в инвентаре" aria-label="Поиск в инвентаре"/></label>
          <select value={inventorySlot} onChange={event=>setInventorySlot(event.target.value)} aria-label="Фильтр по слоту"><option value="all">Все слоты</option>{inventory.slots.filter(slot=>slot!=="bundle").map(slot=><option key={slot} value={slot}>{slotLabels[slot]??slot}</option>)}</select>
          <select value={inventorySort} onChange={event=>setInventorySort(event.target.value)} aria-label="Сортировка инвентаря"><option value="newest">Сначала новые</option><option value="rarity">По редкости</option><option value="name">По названию</option></select>
        </div>
        <div className="inventory-grid">{filteredInventory.map(item=><article key={item.id} className={`inventory-card rarity-${item.rarity}`}>
          <div className="store-item-visual"><CosmeticArt live item={item}/><ItemBadges item={item}/></div>
          <div><small>{slotLabels[item.slot]??categoryLabels[item.category]??item.category}</small><strong>{item.title}</strong><p>Получено {new Date(item.acquiredAt).toLocaleDateString("ru-RU")}</p></div>
          <div className="store-card-actions inventory-actions"><button className="preview" onClick={()=>setPreview(item)}><Eye size={15}/>Просмотр</button><button className="preview" onClick={()=>{setTab("store");setCategory(item.category);setQuery(item.title);window.setTimeout(()=>document.querySelector(".store-catalog")?.scrollIntoView({behavior:"smooth"}),0)}}><ShoppingBag size={15}/>В магазин</button>{item.isBundle?<button disabled>Набор</button>:item.state==="equipped"?<button className="secondary" onClick={()=>void unequip(item)} disabled={!!busy}>Снять</button>:<button onClick={()=>void equip(item)} disabled={!!busy}>Надеть</button>}</div>
        </article>)}</div>
        {!filteredInventory.length?<div className="store-empty"><PackageOpen size={30}/><strong>В этом разделе пока пусто</strong><p>Откройте магазин и добавьте первые предметы в коллекцию.</p><button onClick={()=>setTab("store")}>Открыть магазин</button></div>:null}
      </section>
    </div>:null}

    {!loading&&tab==="quests"?<div className="quests-page">
      <div className="personal-streak"><Gift size={22}/><span><strong>Серия: {streak} дн.</strong><small>Зарабатывайте Orbs и открывайте новые предметы.</small></span></div>
      <div className="personal-economy-grid">{quests.map(quest=><article key={quest.key}><small>{quest.period==="daily"?"ЕЖЕДНЕВНЫЙ":"ЕЖЕНЕДЕЛЬНЫЙ"}</small><strong>{quest.title}</strong><p>{quest.description}</p><div className="personal-progress" role="progressbar" aria-valuenow={quest.progress} aria-valuemin={0} aria-valuemax={quest.target} aria-label={quest.title}><i style={{width:`${Math.min(100,100*quest.progress/quest.target)}%`}}/></div><span>{quest.progress}/{quest.target} · {quest.xp} XP · {quest.coins} Orbs</span><button disabled={quest.claimed||quest.progress<quest.target||!!busy} onClick={()=>void claimQuest(quest.key)}>{quest.claimed?"Получено":busy===quest.key?"Забираем…":"Забрать"}</button></article>)}</div>
    </div>:null}

    {!loading&&tab==="history"?<div className="personal-ledger">{ledger.length?ledger.map(entry=><article key={entry.id}><span><strong>{entry.reason}</strong><small>{new Date(entry.createdAt).toLocaleString("ru-RU")}</small></span><b className={entry.amount>0?"positive":""}>{entry.amount>0?"+":""}{entry.amount} Orbs</b></article>):<div className="store-empty"><Coins size={28}/><strong>Операций пока нет</strong><p>Выполните квест или купите первый предмет.</p></div>}</div>:null}

    {previewItem?<div className="store-preview-backdrop" role="presentation" onClick={()=>setPreview(null)}>
      <section className="store-preview-dialog" role="dialog" aria-modal="true" aria-label={`Предпросмотр: ${previewItem.title}`} onClick={event=>event.stopPropagation()}>
        <button className="store-preview-close" onClick={()=>setPreview(null)} aria-label="Закрыть"><X/></button>
        <div className="store-preview-stage">
          <div className={`store-preview-profile cosmetic-${previewItem.preview}`}>
            <div className="store-preview-banner" style={identity?.bannerUrl?{backgroundImage:`url("${identity.bannerUrl}")`}:undefined}/>
            <div className="store-preview-avatar">{identity?.avatarUrl?<MediaImage src={identity.avatarUrl} alt="" sizes="82px"/>:(identity?.displayName??"FZ").slice(0,2)}</div>
            <CosmeticArt live item={previewItem}/>
            <strong>{identity?.displayName??"Ваш профиль"}</strong><span>@flipzero</span>
          </div>
        </div>
        <div className="store-preview-copy"><ItemBadges item={previewItem}/><small>{rarityLabels[previewItem.rarity]??previewItem.rarity}</small><h3>{previewItem.title}</h3><p>{previewItem.description}</p><div className="store-preview-price">{previewItem.priceOrbs} Orbs</div><div className="store-card-actions">{actionFor(previewItem)}</div></div>
      </section>
    </div>:null}
  </div>;
}
