"use client";
/* THE TV LOBBY in the marquee's look (the owner, 1 Nov): the room code in lit letter tiles, the QR code framed
   in gold, the sign small at the top; the teams under them, 2 to 8 (2 side by side, 3 or 4 in a row, 5-6 in two
   rows of 3, 7-8 in two rows of 4). Captains in gold with a C armband, first in their team; a team with players
   but no captain says so in a dashed gold chip. The lobby's own controls along the bottom. */
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { teamName, type Member, type Room } from "@/lib/room";
import { MANY_COLORS, LETTERS } from "@/lib/many/logic";
import { manyNames } from "@/lib/many/useTvMany";
import { CodeTiles, MqStage, Sign, useLights } from "./Marquee";

const colsOf = (k: number) => (k <= 2 ? 2 : k === 3 ? 3 : k === 4 ? 4 : k <= 6 ? 3 : 4);
/* the players' cells: big while every team fits, then smaller and in more columns as the biggest team grows (the
   owner, 2 Nov), the same size in every card. c columns × r rows, h px tall, f px text, g px apart; each tier fits
   its card at that many teams. Past the last tier, the last cell is "+N more". */
type Tier = { c: number; r: number; h: number; f: number; g: number; nf?: boolean };   // nf: the dense ones (smaller faces, tighter cells: the name gets the room)
const TIERS: Record<string, Tier[]> = {
  k2: [{ c: 2, r: 3, h: 70, f: 28, g: 12 }, { c: 3, r: 4, h: 54, f: 22, g: 10 }, { c: 3, r: 5, h: 44, f: 18, g: 8 }, { c: 4, r: 6, h: 36, f: 15, g: 6, nf: true }],
  k3: [{ c: 2, r: 4, h: 58, f: 24, g: 10 }, { c: 2, r: 5, h: 46, f: 19, g: 8 }, { c: 3, r: 6, h: 38, f: 15, g: 6, nf: true }],
  k4: [{ c: 1, r: 6, h: 42, f: 20, g: 8 }, { c: 2, r: 7, h: 36, f: 16, g: 6, nf: true }, { c: 2, r: 8, h: 31, f: 14, g: 5, nf: true }],
  k6: [{ c: 2, r: 3, h: 38, f: 18, g: 8 }, { c: 3, r: 3, h: 38, f: 15, g: 6, nf: true }, { c: 3, r: 4, h: 28, f: 13, g: 5, nf: true }],
  k8: [{ c: 2, r: 3, h: 36, f: 16, g: 8 }, { c: 2, r: 4, h: 29, f: 14, g: 6 }, { c: 2, r: 5, h: 23, f: 12, g: 4, nf: true }, { c: 3, r: 5, h: 23, f: 11, g: 4, nf: true }],
};
const tiersOf = (k: number) => TIERS[k <= 4 ? "k" + Math.max(2, k) : k <= 6 ? "k6" : "k8"];
/* cells a team needs: its players, and a whole row for "Needs a captain" */
const need = (n: number, capless: boolean, t: Tier) => n + (capless && n > 0 ? t.c : 0);

/* a name that shrinks to fit its cell (down to min of its size) before it is cut with "…" */
function Fit({ text, min = 0.62, className = "" }: { text: string; min?: number; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    /* the text's exact width (a part of a pixel too wide is enough for the browser to cut it with "…") */
    /* (a few passes: letter spacing doesn't shrink with the text, so one pass falls a little short) */
    const fit = () => {
      el.style.fontSize = "";
      const box = el.getBoundingClientRect().width, r = document.createRange(); r.selectNodeContents(el);
      if (!box) return;
      let f = 1;
      for (let i = 0; i < 4; i++) {
        const text = r.getBoundingClientRect().width;
        if (text <= box || f <= min) break;
        f = Math.max(min, (f * (box - 1)) / text); el.style.fontSize = f + "em";
      }
    };
    fit();
    /* (its box is the space it has, whatever its text: see .fit, flex 1 1 0) */
    const ro = new ResizeObserver(fit); ro.observe(el);
    void document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, [text, min]);
  return <bdi ref={ref} className={"fit " + className}>{text}</bdi>;
}

export function TvLobby({ room, members, code, k, joinUrl, site, status, controls }: {
  room: Room; members: Member[]; code: string; k: number; joinUrl: string; site: string; status: ReactNode; controls: ReactNode }) {
  const lights = useLights(120), many = k > 2;
  const names = many ? manyNames(room, k) : [teamName(room, 0), teamName(room, 1)];
  const away = ((room.state?.away as string[] | undefined) || []);
  return (
    <div className={"mq mq-lobby k" + k + lights}>
      <MqStage floor />
      <div className="brand"><Sign size={many ? 42 : 50}>Quiz Me Baby</Sign></div>
      <div className="code">
        <div className="lab">Join with this code</div>
        <CodeTiles code={code} />
        <div className="url">Go to <b>{site}</b> or scan the code</div>
      </div>
      <div className="qr"><QRCodeSVG value={joinUrl} size={k >= 5 ? 160 : 196} bgColor="#f4f6ff" fgColor="#04050e" title="Scan to join this game" /></div>
      {(() => { const lists = names.map((_, t) => members.filter((m) => (m.team as number) === t).sort((x, y) => (x.role === "captain" ? -1 : 0) - (y.role === "captain" ? -1 : 0)));
        const tiers = tiersOf(k), tier = tiers.find((T) => lists.every((l) => need(l.length, !l.some((m) => m.role === "captain"), T) <= T.c * T.r)) || tiers[tiers.length - 1];
        const cellStyle = { ["--pc" as string]: tier.c, ["--ph" as string]: tier.h + "px", ["--pf" as string]: tier.f + "px", ["--pg" as string]: tier.g + "px" };
        return (
      <div className="teams" style={{ gridTemplateColumns: `repeat(${colsOf(k)}, minmax(0, 1fr))` }}>
        {names.map((name, t) => {
          const list = lists[t];
          const cap = list.find((m) => m.role === "captain"), cells = tier.c * tier.r - (cap || !list.length ? 0 : tier.c);   // ("Needs a captain" takes a whole row)
          const shown = list.length > cells ? list.slice(0, cells - 1) : list, more = list.length - shown.length;
          return (
            <div key={t} className={"team" + (tier.nf ? " nf" : "")} style={{ ["--c" as string]: MANY_COLORS[t], ...cellStyle }}>
              <div className="hd">
                <b><span className="dt">{LETTERS[t]}</span><Fit text={name} min={0.6} className="tn" /></b>
                <span>{list.length} {list.length === 1 ? "player" : "players"}</span>
              </div>
              <div className="ppl">
                {list.length === 0 && <span className="none">Nobody yet</span>}
                {list.length > 0 && !cap && <span className="need">Needs a captain</span>}
                {shown.map((m) => { const gone = m.role === "captain" && away.includes(m.user_id); return (
                  /* a captain whose phone the TV hasn't heard from: the cell dims, the face sleeps (the owner, 1 Nov: no red badge) */
                  <span key={m.user_id} className={"pop-in" + (m.role === "captain" ? " capt" : "") + (gone ? " is-away" : "")} title={gone ? `${m.name} is away` : undefined}>
                    {m.role === "captain" && <b className="arm" aria-label="Captain">C</b>}
                    <i aria-label={gone ? "away" : undefined}>{gone ? "💤" : m.avatar || "🙂"}</i><Fit text={m.name} />
                  </span>); })}
                {more > 0 && <span className="more">+{more} more</span>}
              </div>
            </div>);
        })}
      </div>); })()}
      <div className="bar">
        <div className="bl">{status}</div>
        <div className="br">{controls}</div>
      </div>
    </div>);
}
