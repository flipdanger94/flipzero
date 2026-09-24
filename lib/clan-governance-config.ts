export const CLAN_SEASON={minimumContributionXp:100,rankRewards:[300,180,100],topBadgeCount:10} as const;
export const CLAN_UPGRADES={
 tag_palette:{label:"Палитра тега",prices:[150,350,700]},
 clan_banner:{label:"Знамя клана",prices:[220,500]},
 clan_emoji:{label:"Эмодзи клана",prices:[180,420]},
 custom_roles:{label:"Роли клана",prices:[280,600]},
 xp_boost:{label:"Бонус XP клана",prices:[500,900],bonusPercentPerLevel:2},
} as const;
export const seasonKey=(date=new Date())=>date.toISOString().slice(0,7);
export const seasonEndsAt=(date=new Date())=>new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,1));
