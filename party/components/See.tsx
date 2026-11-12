"use client";
/* What Do You See? on screen (12 Nov, the owner): the picture that clears as the clock runs, for the TV and the
   phones, two teams or eight. A face or a logo starts blurred and sharpens; a close-up starts zoomed right in on one
   spot and pulls back to the whole picture. In steps (lib/see.ts), each easing into the next, worked out from the
   TV's clock, so every screen shows the same step at the same moment; with animations off in Settings, 5 plain steps
   and no easing (the picture still clears: it is the game). The blur is a share of the picture's width, so a phone
   and the TV look the same. */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Clock, tvNow } from "./Clock";
import { motionOff } from "./Marquee";
import { seeAsk, seeBlur, seeGone, seeSecs, seeStep, seeZoom, type SePub } from "@/lib/see";

export type SeeTeam = { name: string; color: string; letter: string };
const OK = "var(--color-ok)", NO = "var(--color-no)";

/* the blur, drawn on a canvas (12 Nov, the owner saw a line across a blurred face: Safari draws a CSS blur in tiles,
   and their edges can show). The picture is drawn small, blurred there (three box passes, edges held), then drawn
   back up to size: the same soft picture in every browser, and cheap, as the small copy is at most 480 wide */
function boxPass(src: Float32Array, dst: Float32Array, w: number, h: number, r: number, horiz: boolean) {
  const n = 2 * r + 1, len = horiz ? w : h, lines = horiz ? h : w, step = horiz ? 4 : w * 4;
  for (let l = 0; l < lines; l++) {
    const base = horiz ? l * w * 4 : l * 4;
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let i = -r; i <= r; i++) sum += src[base + Math.min(len - 1, Math.max(0, i)) * step + c];
      for (let i = 0; i < len; i++) {
        dst[base + i * step + c] = sum / n;
        sum += src[base + Math.min(len - 1, i + r + 1) * step + c] - src[base + Math.max(0, i - r) * step + c];
      }
    }
  }
}
function drawSee(cv: HTMLCanvasElement, img: HTMLImageElement, cssW: number, sigma: number) {
  const dpr = Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
  const W = Math.max(4, Math.round(cssW * dpr)), H = Math.max(3, Math.round(W * 3 / 4));
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const ctx = cv.getContext("2d"); if (!ctx) return;
  /* the picture's middle, 4:3 (as object-fit: cover) */
  const iw = img.naturalWidth, ih = img.naturalHeight, k0 = Math.max(W / iw, H / ih);
  let sw = W / k0, sh = H / k0, sx = (iw - sw) / 2, sy = (ih - sh) / 2;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  const s = sigma * dpr;
  if (s < 0.6) { ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H); return; }
  /* the small copy: about 2.5 of its pixels to the blur, 480 wide at most; halved step by step on the way down,
     so no browser skips pixels and makes it sparkle */
  const k = Math.min(1, 2.5 / s, 480 / W), w = Math.max(6, Math.round(W * k)), h = Math.max(5, Math.round(H * k));
  let src: CanvasImageSource = img;
  while (sw / 2 >= w * 1.2) {
    const c = document.createElement("canvas"); c.width = Math.round(sw / 2); c.height = Math.round(sh / 2);
    const x = c.getContext("2d"); if (!x) break;
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high"; x.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
    src = c; sx = 0; sy = 0; sw = c.width; sh = c.height;
  }
  const sm = document.createElement("canvas"); sm.width = w; sm.height = h;
  const c2 = sm.getContext("2d", { willReadFrequently: true }); if (!c2) return;
  c2.imageSmoothingEnabled = true; c2.imageSmoothingQuality = "high"; c2.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
  /* what's left of the blur at the small size: three box passes of radius r come to about sqrt((4r^2+4r)/4) */
  const left = Math.max(0, s * w / W), r = Math.round(Math.max(0, Math.sqrt(left * left * 4 + 1) - 1) / 2);
  if (r > 0) {
    const d = c2.getImageData(0, 0, w, h), a = new Float32Array(d.data), b = new Float32Array(a.length);
    for (let p = 0; p < 3; p++) { boxPass(a, b, w, h, r, true); boxPass(b, a, w, h, r, false); }
    for (let i = 0; i < a.length; i++) if (i % 4 !== 3) d.data[i] = a[i];
    c2.putImageData(d, 0, 0);
  }
  ctx.drawImage(sm, 0, 0, W, H);
}

/* the picture itself, 4:3, w wide at most (it shrinks to fit a narrower column). clear: the whole picture, sharp */
export function SeePicture({ see, deadline, left, clear, w, big, alt }: { see: SePub; deadline?: number | null; left?: number; clear?: boolean; w: number; big?: boolean; alt?: string }) {
  const still = motionOff();
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(w);
  useEffect(() => {
    const el = ref.current; if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width || w));
    ro.observe(el); return () => ro.disconnect();
  }, [w]);
  /* the step from the TV's clock: looked at five times a second, drawn again only when the step changes */
  const [now, setNow] = useState(() => tvNow());
  useEffect(() => {
    if (clear || !deadline) return;
    setNow(tvNow());
    const t = setInterval(() => setNow(tvNow()), 200);
    return () => clearInterval(t);
  }, [deadline, clear]);
  const q = clear ? 1 : seeStep(seeGone(see.total, deadline, left, now), see.total, still);
  const src = `/see/${see.photo}${big ? "" : "-s"}.jpg`;
  /* a face or a logo while it clears: two canvases, the new step fading in over the last (none with animations off) */
  const canvas = see.effect !== "zoom" && !clear;
  const sigma = canvas ? seeBlur(q, see.kind).b * width : 0;
  const cv0 = useRef<HTMLCanvasElement>(null), cv1 = useRef<HTMLCanvasElement>(null), front = useRef(-1);
  const [pic, setPic] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!canvas) return;
    let live = true; const im = new Image(), cs = [cv0.current, cv1.current];
    im.onload = () => { if (live) setPic(im); };
    im.src = src;
    /* (a new picture, the host's Change picture: the last one's canvases hidden till the new one is drawn) */
    return () => { live = false; setPic(null); front.current = -1; cs.forEach((c) => { if (c) { c.style.transition = "none"; c.style.opacity = "0"; } }); };
  }, [canvas, src]);
  const key = Math.round(sigma * 10);
  useEffect(() => {
    if (!canvas || !pic || !pic.naturalWidth) return;
    const cs = [cv0.current, cv1.current]; if (!cs[0] || !cs[1]) return;
    const first = front.current < 0, nb = first ? 0 : 1 - front.current, cv = cs[nb]!, old = cs[1 - nb]!;
    drawSee(cv, pic, width, key / 10);
    cv.style.transition = "none"; cv.style.zIndex = "2"; old.style.zIndex = "1";
    if (first || still) { cv.style.opacity = "1"; old.style.opacity = "0"; }
    else { old.style.opacity = "1"; cv.style.opacity = "0"; void cv.offsetWidth; cv.style.transition = "opacity .8s ease-out"; cv.style.opacity = "1"; }
    front.current = nb;
  }, [canvas, pic, width, key, still]);
  let style: CSSProperties | undefined;
  if (see.effect === "zoom") {
    const { z, x, y } = seeZoom(q, see.zoom);
    style = { transformOrigin: "0 0", transform: `scale(${z.toFixed(4)}) translate(${(-x * 100).toFixed(3)}%, ${(-y * 100).toFixed(3)}%)` };
  }
  return (
    <div ref={ref} className={"see-frame" + (see.kind === "logo" ? " logo" : "") + (still ? " still" : "") + (clear ? " clear" : "")} style={{ width: `min(100%, ${w}px)` }}>
      {canvas ? (<>
        <canvas ref={cv0} role="img" aria-label="The picture" style={{ opacity: 0 }} />
        <canvas ref={cv1} aria-hidden style={{ opacity: 0 }} />
      </>)
        /* eslint-disable-next-line @next/next/no-img-element */
        : <img src={src} alt={clear && alt ? alt : "The picture"} draggable={false} style={style} />}
    </div>);
}

/* the credit, under the clear picture (each licence asks for it) */
export const SeeCredit = ({ see, size = 13 }: { see: SePub; size?: number }) => see.rev ? (
  <div className="see-credit" style={{ fontSize: size }}>Picture: <bdi>{see.rev.credit}</bdi> · {see.rev.licence} · Wikimedia Commons</div>) : null;

/* the line under the answer: who took it, and how fast */
/* right: how many teams got it (3 to 8: the fastest is named, "first" when others got it too) */
export function seeWho(see: SePub, teams: SeeTeam[], right?: number): { text: string; color: string } {
  const r = see.rev;
  if (!r || r.who == null) return { text: "Nobody got it", color: "var(--color-ink-2)" };
  return { text: `${teams[r.who]?.name ?? ""} got it ${(right ?? 0) > 1 ? "first, " : ""}in ${seeSecs(r.ms)}`, color: teams[r.who]?.color ?? "var(--color-gold)" };
}

/* every team's state while the picture clears: thinking, buzzed (it has its 10 seconds), or out of this picture (a
   wrong answer, or none in time: everyone heard it) */
export function SeeTicks({ teams, out, buzz, size = 22, column }: { teams: SeeTeam[]; out?: boolean[]; buzz?: number | null; size?: number; column?: boolean }) {
  const many = teams.length > 2;
  return (
    <div className={"flex flex-wrap justify-center " + (column ? "flex-col items-center gap-1" : many ? "gap-x-5 gap-y-2" : "gap-x-10 gap-y-2")} role="status" aria-live="polite">
      {teams.map((t, i) => (
        <span key={i} className="flex items-center gap-2 font-bold" style={{ fontSize: size }}>
          <span className="dot ltr shrink-0" aria-hidden style={{ background: t.color, width: size * 1.25, height: size * 1.25, fontSize: size * 0.7 }}>{t.letter}</span>
          {!many && <bdi style={{ color: t.color }}>{t.name}</bdi>}
          <span style={{ color: out?.[i] ? NO : buzz === i ? OK : "var(--color-ink-3)" }}>{out?.[i] ? "✗ out" : buzz === i ? "buzzed!" : many ? "…" : "thinking…"}</span>
        </span>))}
    </div>);
}

/* what the team that buzzed does now (the TV says it to the room): whoever hit BUZZ says it, the captain types it */
export const SeeSay = ({ see }: { see: SePub }) => (
  <div className="text-24 font-bold leading-snug text-balance">{see.by ? <><bdi>{see.by}</bdi> buzzed. </> : null}Say it out loud! Captain, type it!</div>);

/* ---- the TV, two teams ---- */
export function SeeTv({ see, screen, teams, clock, deadline, left, rows }: {
  see: SePub; screen: "seeQ" | "seeReveal"; teams: SeeTeam[]; clock?: ReactNode; deadline?: number | null; left?: number; rows?: ReactNode }) {
  /* (12 Nov, the owner: a buzzer. A buzz stops the picture where it is; the team that buzzed says it out loud and
     types it, with its own 10 seconds on the clock) */
  if (screen === "seeQ") { const b = see.buzz != null ? teams[see.buzz] : null; return (
    <div className="flex gap-12 items-center w-full justify-center">
      <div className="flex-1 min-w-0 flex justify-center"><SeePicture see={see} deadline={deadline} left={left} w={720} big /></div>
      <div className="w-[360px] shrink-0 flex flex-col items-center gap-5">
        {b ? (<>
          <div className="display text-44 leading-tight text-balance" role="status" style={{ color: b.color }}><bdi>{b.name}</bdi> buzzed!</div>
          {see.typeBy ? <Clock deadline={see.typeBy} size={130} /> : clock}
          <SeeSay see={see} />
        </>) : (<>
          <div className="display text-44 leading-tight text-balance" style={{ color: "var(--color-gold)" }}>{seeAsk(see.kind)}</div>
          {clock}
          <div className="text-24 font-bold leading-snug">Know it? Buzz!</div>
        </>)}
        <SeeTicks teams={teams} out={see.out} buzz={see.buzz} column />
        <div className="text-20 text-[var(--color-ink-2)] leading-snug text-balance">{b ? "Wrong, and you’re out of this picture." : "Buzz, say it out loud and type it. Wrong, and you’re out of this picture."}</div>
      </div>
    </div>); }
  const who = seeWho(see, teams), A = see.rev?.answer || "";
  return (
    <div className="flex gap-12 items-center w-full justify-center">
      <div className="flex-1 min-w-0 flex flex-col items-center gap-2">
        <SeePicture see={see} clear w={620} big alt={A} />
        <SeeCredit see={see} size={14} />
      </div>
      <div className="w-[440px] shrink-0 flex flex-col items-center gap-4">
        <div className="eyebrow text-18">It&rsquo;s</div>
        <div className="ans-board display beat slam leading-none" style={{ fontSize: A.length > 22 ? 44 : A.length > 14 ? 56 : 70, color: "var(--color-gold)" }}>{A}</div>
        {rows}
        <div className="display text-36 beat" style={{ color: who.color }}>{who.text}</div>
      </div>
    </div>);
}
