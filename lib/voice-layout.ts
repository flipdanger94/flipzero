export type VoiceGridLayout={columns:number;rows:number;visible:number};

export function voiceGridLayout(count:number, compact=false):VoiceGridLayout{
  const safe=Math.max(0,Math.floor(Number.isFinite(count)?count:0));
  const visible=Math.min(safe,50);
  if(visible<=1)return{columns:1,rows:visible?1:0,visible};
  if(visible===2)return{columns:2,rows:1,visible};
  if(visible===3)return{columns:3,rows:1,visible};
  if(visible===4)return{columns:2,rows:2,visible};
  if(visible<=9){const columns=3;return{columns,rows:Math.ceil(visible/columns),visible}}
  const columns=compact?5:4;
  return{columns,rows:Math.ceil(visible/columns),visible};
}
