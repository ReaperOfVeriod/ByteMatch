import { ImageResponse } from "next/og";
import { config } from "@/lib/config";
import { MONO, OG, OG_SIZE, SANS, UnitGrid, Wordmark, ogFonts } from "@/lib/og";
import { SITE_TAGLINE, siteHost } from "@/lib/seo";

export const alt = "ByteMatch: decompilation progress, tracked.";
export const size = OG_SIZE;
export const contentType = "image/png";
// SITE_NAME and PUBLIC_URL are read at request time, not baked in at build.
export const dynamic = "force-dynamic";

export default async function Image() {
  const name = config().SITE_NAME;
  return new ImageResponse(
    <div
      style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: OG.bg, fontFamily: SANS, color: OG.text }}
    >
      <div style={{ position: "absolute", top: 39, right: 33, display: "flex" }}>
        <UnitGrid cols={12} rows={17} progress={0.62} />
      </div>
      {/* Shade between the motif and the text. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 860,
          height: "100%",
          display: "flex",
          backgroundImage: `linear-gradient(90deg, ${OG.bg} 0%, ${OG.bg} 70%, rgba(11,15,23,0) 100%)`,
        }}
      />
      <div style={{ position: "absolute", left: 0, bottom: 0, width: "100%", height: 6, display: "flex", background: OG.done }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "76px 80px 70px", width: "100%" }}>
        <Wordmark name={name} size={76} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 60, fontWeight: 600, letterSpacing: -1.5, lineHeight: 1.1, maxWidth: 700 }}>{SITE_TAGLINE}</div>
          <div style={{ fontSize: 28, color: OG.text2, marginTop: 22, maxWidth: 640, lineHeight: 1.4 }}>
            Matching decompilation projects, from objdiff reports: history, badges and PR comments.
          </div>
        </div>
        <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 24, color: OG.accent }}>{siteHost()}</div>
      </div>
    </div>,
    { ...size, fonts: await ogFonts() },
  );
}
