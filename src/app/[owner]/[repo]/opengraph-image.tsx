import { ImageResponse } from "next/og";
import { config } from "@/lib/config";
import { MONO, OG, OG_SIZE, SANS, UnitGrid, Wordmark, ogFonts } from "@/lib/og";
import { platformName } from "@/lib/platforms";
import { resolve } from "@/lib/project-data";
import { siteHost } from "@/lib/seo";

export const alt = "Decompilation progress";
export const size = OG_SIZE;
export const contentType = "image/png";
export const dynamic = "force-dynamic";

const fmt = new Intl.NumberFormat("en-US");
const clampPct = (n: number) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));
const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

type Card = {
  name: string;
  path: string;
  platform: string | null;
  version: string | null;
  measures: { code: number; fuzzy: number; fnDone: number; fnTotal: number } | null;
};

async function load(owner: string, repo: string): Promise<Card> {
  const fallback: Card = { name: `${owner}/${repo}`, path: `${owner}/${repo}`, platform: null, version: null, measures: null };
  try {
    const r = await resolve(owner, repo);
    const m = r.measures;
    return {
      name: r.project.name,
      path: `${r.project.owner}/${r.project.repo}`,
      platform: platformName(r.project.platform),
      version: r.versions.length > 1 ? r.version : null,
      measures: {
        code: Number(m.matched_code_percent),
        fuzzy: Number(m.fuzzy_match_percent),
        fnDone: Number(m.matched_functions),
        fnTotal: Number(m.total_functions),
      },
    };
  } catch {
    // Not found, no reports yet, or the database is unavailable: a generic card for the URL.
    return fallback;
  }
}

export default async function Image({ params }: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await params;
  const card = await load(owner, repo);
  const m = card.measures;
  const code = m ? clampPct(m.code) : 0;
  const fuzzy = m ? Math.max(code, clampPct(m.fuzzy)) : 0;
  const nameSize = card.name.length > 34 ? 46 : 60;
  const barWidth = 1040;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        background: OG.bg,
        fontFamily: SANS,
        color: OG.text,
        padding: "60px 80px 56px",
      }}
    >
      <div style={{ position: "absolute", top: 46, right: 46, display: "flex", opacity: 0.5 }}>
        <UnitGrid cols={8} rows={4} cell={18} gap={5} progress={m ? code / 100 : 0.3} seed={owner.length * 31 + repo.length} />
      </div>
      <div style={{ display: "flex", alignItems: "center" }}>
        <Wordmark name={config().SITE_NAME} size={30} color={OG.text2} />
        {card.platform ? (
          <div
            style={{
              display: "flex",
              marginLeft: 22,
              padding: "6px 14px",
              border: `1px solid ${OG.line}`,
              borderRadius: 999,
              background: OG.surface,
              fontSize: 22,
              color: OG.text2,
            }}
          >
            {card.version ? `${card.platform} · ${truncate(card.version, 18)}` : card.platform}
          </div>
        ) : null}
      </div>

      <div
        style={{ display: "flex", marginTop: 44, fontSize: nameSize, fontWeight: 600, letterSpacing: -1.2, lineHeight: 1.1, maxWidth: 900 }}
      >
        {truncate(card.name, 60)}
      </div>

      {m ? (
        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <div style={{ fontSize: 150, fontWeight: 600, letterSpacing: -4, lineHeight: 1, color: OG.text }}>{`${code.toFixed(2)}%`}</div>
            <div style={{ fontSize: 44, color: OG.text2, marginLeft: 22, marginBottom: 18 }}>decompiled</div>
          </div>
          <div
            style={{
              display: "flex",
              position: "relative",
              width: barWidth,
              height: 22,
              marginTop: 30,
              borderRadius: 11,
              background: OG.track,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                height: 22,
                width: (barWidth * fuzzy) / 100,
                borderRadius: 11,
                background: OG.partial,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                height: 22,
                width: (barWidth * code) / 100,
                borderRadius: 11,
                background: OG.done,
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 26, fontSize: 28, color: OG.text2 }}>
            <div style={{ display: "flex" }}>{`${fmt.format(m.fnDone)} / ${fmt.format(m.fnTotal)} functions matched`}</div>
            <div
              style={{ display: "flex", fontFamily: MONO, fontWeight: 500, fontSize: 24, color: OG.accent }}
            >{`${siteHost()}/${card.path}`}</div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
          <div style={{ fontSize: 48, color: OG.text2 }}>Decompilation progress</div>
          <div style={{ display: "flex", fontFamily: MONO, fontWeight: 500, fontSize: 24, color: OG.accent, marginTop: 26 }}>
            {`${siteHost()}/${card.path}`}
          </div>
        </div>
      )}
    </div>,
    { ...size, fonts: await ogFonts() },
  );
}
