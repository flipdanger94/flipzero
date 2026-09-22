import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "FlipZero — чаты, голос и сообщества";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{
      width: "100%", height: "100%", display: "flex", position: "relative",
      background: "linear-gradient(135deg,#030914 0%,#091632 55%,#170932 100%)",
      color: "white", fontFamily: "sans-serif", overflow: "hidden"
    }}>
      <div style={{ position:"absolute", width:520, height:520, borderRadius:999, right:-90, top:-150, background:"radial-gradient(circle,#4774ff66 0%,#18367b33 45%,transparent 70%)" }} />
      <div style={{ position:"absolute", width:420, height:420, borderRadius:999, right:120, bottom:-220, background:"radial-gradient(circle,#c33dff55 0%,transparent 68%)" }} />
      <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", padding:"72px 80px", width:"100%", zIndex:2 }}>
        <div style={{ display:"flex", alignItems:"center", gap:18, marginBottom:46 }}>
          <div style={{ width:64, height:64, borderRadius:18, display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(135deg,#4d72ff,#d83bf2)", fontSize:34, fontWeight:800 }}>F</div>
          <div style={{ fontSize:34, fontWeight:800 }}>FlipZero</div>
        </div>
        <div style={{ fontSize:72, lineHeight:1.02, fontWeight:900, letterSpacing:-3 }}>Ваши люди.<br />Ваше место.</div>
        <div style={{ marginTop:26, maxWidth:760, fontSize:28, color:"#b8c5e6", lineHeight:1.35 }}>Чаты, голос, видео и сообщества в одном пространстве.</div>
      </div>
    </div>,
    size
  );
}
