export const ECONOMY={
  dailyActivityCoins:40,
  superFlipRewardMultiplier:1.2,
  activityCooldownSeconds:30,
  dailyQuestCoinCap:300,
  dailyRewardCap:500,
  streakMaxBonus:70,
} as const;
export const QUEST_CATALOG=[
  {key:"daily_message",title:"Общение каждый день",description:"Напишите 5 сообщений в каналах",period:"daily",source:"message",target:5,xp:40,coins:30},
  {key:"daily_clan",title:"На связи с кланом",description:"Напишите 2 сообщения в клановом чате",period:"daily",source:"clan_message",target:2,xp:30,coins:25},
  {key:"weekly_message",title:"Голос сообщества",description:"Напишите 30 сообщений за неделю",period:"weekly",source:"message",target:30,xp:120,coins:90},
  {key:"weekly_voice",title:"Время в эфире",description:"Проведите 60 минут в голосовых комнатах",period:"weekly",source:"voice_minute",target:60,xp:130,coins:100},
  {key:"weekly_friend",title:"Новые знакомства",description:"Пригласите друга",period:"weekly",source:"invite_joined",target:1,xp:80,coins:70},
] as const;
import cosmeticCatalog from "@/config/cosmetics.json";
export const COSMETIC_CATALOG=cosmeticCatalog;
