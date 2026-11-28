"use client";
/* The screen check's page (npm run screens, sim/screens/run.mjs): one screen from a simulated night, drawn as the
   game draws it, so a browser can measure it. Only there: the ".screens.tsx" ending makes it a page only when
   QMB_SCREENS=1 (next.config.mjs), so `npm run dev` and every deploy have no /screens.
     #tv:<key>              the TV (the 1280x720 stage)
     #ph:<role>:<key>       a phone with a TV in the room (role: host, cap, player)
     #pn:<role>:<key>       a phone with no TV
     #lobby:<teams>         the TV's lobby with 2 to 8 teams
     #setup:<teams>:<role>  the phone's Setup before the start (2 teams: host, or cap with no host; 3-8: host), with
                            its game time under Start (14 Nov)
   <key> is a screen kept by sim/screens/two.mjs or many.ts (sim/.out/screens/pubs.json, served by ./pubs). */
import { MANY_COLORS } from "@/lib/many/logic";
import { Mascot, MascotPick } from "@/components/Mascot";
import { useEffect, useState } from "react";
import { TvGame } from "@/components/TvGame";
import { TvMany } from "@/components/many/TvMany";
import { TvStage } from "@/components/TvStage";
import { HostGame, CaptainGame, PlayerGame } from "@/components/PhoneGame";
import { PhoneMany } from "@/components/many/PhoneMany";
import { Hud } from "@/components/GameParts";
import { HudMany } from "@/components/many/PartsMany";
import { NoTv } from "@/components/NoTv";
import { TvLobby } from "@/components/LobbyTv";
import { SideSlot, useSideways } from "@/components/Side";
import { Setup } from "@/components/Setup";
import { SetupMany } from "@/components/many/LineupMany";
import { DEFAULTS } from "@/lib/settings";

const JOIN = { url: "https://quizmebaby.app/join/ABCD", code: "ABCD" };
/* the night was played on a clock of its own: move its times to now, so clocks and animations run as they did */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const shift = (x: any, d: number, at: number): any => {
  if (Array.isArray(x)) return x.map((y) => shift(y, d, at));
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, shift(v, d, at)]));
  if (typeof x === "number" && Math.abs(x - at) < 4 * 3600e3) return x + d;
  return x;
};

export default function Screens() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rec, setRec] = useState<any>(null);
  const [mode, setMode] = useState<string[]>([]);
  /* a phone held sideways: the left column takes the picture, the clock and the question, as in a room (app/room) */
  const sideways = useSideways(), [sideSlot, setSideSlot] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const h = decodeURIComponent(location.hash.slice(1)).split(":");
    setMode(h);
    if (h[0] === "lobby" || h[0] === "setup") return;
    void fetch("/screens/pubs").then((r) => r.json()).then((d) => {
      const r = d[h[h.length - 1]];
      if (r) setRec({ pub: shift(r.pub, Date.now() - r.now, r.now), secret: r.secret ? shift(r.secret, Date.now() - r.now, r.now) : {} });
    });
  }, []);
  /* another moment on the same page, without reloading it (window.dispatchEvent(new CustomEvent("screens:go", { detail:
     key }))): what happens as one screen gives way to the next, the points flying into the totals (12 Nov) */
  useEffect(() => {
    /* (or a moment handed in whole, { pub, secret }: a screen as it changes, recorded as a video, 28 Nov) */
    const go = (e: Event) => { const det = (e as CustomEvent).detail;
      if (det && typeof det === "object" && det.pub) { setRec({ pub: det.pub, secret: det.secret || {} }); return; }
      const k = String(det || "");
      void fetch("/screens/pubs").then((r) => r.json()).then((d) => { const r = d[k];
        if (r) setRec({ pub: shift(r.pub, Date.now() - r.now, r.now), secret: r.secret ? shift(r.secret, Date.now() - r.now, r.now) : {} }); }); };
    window.addEventListener("screens:go", go);
    return () => window.removeEventListener("screens:go", go);
  }, []);

  if (mode[0] === "lobby") {
    const k = Number(mode[1]);
    const names = ["The Quizzical Owls", "Lions", "Brainy Bunch", "Team D", "Smarty Pants", "Les Gros Malins", "Quizteama Aguilera", "Agatha Quiztie"].slice(0, k);
    const ppl = ["Nour", "Karim", "Joe", "Maya", "Rami", "Lea", "Tarek", "Zeina", "Sami", "Rita", "Hadi", "Yara", "Omar", "Dana", "Fadi", "Lina"];
    const mem = ppl.slice(0, Math.min(16, k * 2 + 2)).map((n, i) => ({ room: "ABCD", user_id: "u" + i, name: n, team: (i === 0 ? null : (i - 1) % k) as 0 | null,
      role: (i === 0 ? "host" : i <= k ? "captain" : "player") as never, avatar: null, joined_at: "" }));
    return <TvStage><TvLobby room={{ code: "ABCD", tv_id: "x", status: "lobby", mode: null, state: { teamNames: names }, version: 1 }} members={mem} code="ABCD" k={k}
      joinUrl={JOIN.url} site="quizmebaby.app" status={<span>Hosted by <b>Nour</b>. Ready: <b>Nour</b> starts the game.</span>}
      controls={<button type="button" className="btn btn-sm btn-ghost">Settings</button>} /></TvStage>;
  }
  /* the captain's phone in the lobby: the team's card with its mascot, and the mascot pick (28 Nov); pick:k, the widest name */
  if (mode[0] === "pick") {
    const t = Math.max(0, Number(mode[1] || 2) - 1), c = MANY_COLORS[t];
    return (
      <main className="screen"><section className="flex flex-col gap-3" style={{ ["--tint" as string]: c }}>
        <div className="mq-team" style={{ ["--c" as string]: c }}>
          <Mascot kind={t} color={c} size={58} className="mq-team-msc" />
          <div className="eyebrow">You&rsquo;re on</div>
          <div className="tn"><bdi>WWWWWWWWWWWW</bdi></div>
          <ul className="mq-mates" aria-label="Your team"><li className="capt me"><b className="arm-c" aria-label="Captain">C</b><i aria-hidden>🦊</i><bdi className="truncate">Rami</bdi><span className="you">You</span></li>
            <li><i aria-hidden>🐼</i><bdi className="truncate">Karim</bdi></li></ul>
        </div>
        <div className="card flex flex-col gap-3">
          <div className="flex items-center gap-2"><b className="arm-c lg" aria-hidden>C</b><span className="eyebrow" style={{ color: "var(--color-gold)" }}>You&rsquo;re the captain</span></div>
          <label className="field-label !mb-0" htmlFor="tname">Name your team</label>
          <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}><input id="tname" className="input" defaultValue="WWWWWWWWWWWW" /><button type="submit" className="btn shrink-0">Save</button></form>
          <MascotPick value={t} color={c} onPick={() => {}} />
          <button type="button" className="btn btn-sm btn-ghost self-start">Step down</button>
        </div>
      </section></main>);
  }
  if (mode[0] === "setup") {
    const k = Number(mode[1]), host = mode[2] !== "cap", tv = { settings: DEFAULTS, custom: [], played: 0 };
    /* (#setup:<teams>:<role>:xp: Expert switched on for the question rounds and the flags, 15 Nov) */
    if (mode[3] === "xp" && typeof window !== "undefined" && !localStorage.getItem("qmb.setup.XPXP")) localStorage.setItem("qmb.setup.XPXP", JSON.stringify({ at: Date.now(), v: {
      "two.difficulty": "mixed", "two.flagLevels": ["veasy", "easy", "medium", "hard", "expert"], "many.quizLevels": ["easy", "medium", "hard", "expert"], "many.flagLevels": ["veasy", "easy", "medium", "hard", "expert"] } }));
    /* (#setup:<teams>:<role>:rep, Geography three times, History twice, Music: Repeat a theme, 15 Nov; :repo with its window open) */
    const rep = mode[3] === "rep" || mode[3] === "repo";
    if (rep && typeof window !== "undefined" && !localStorage.getItem("qmb.setup.REPT")) { const t = ["Geography", "History", "Geography", "Music", "History", "Geography"];
      localStorage.setItem("qmb.setup.REPT", JSON.stringify({ at: Date.now(), v: { "two.themes": t, "two.rounds": 6, "many.themes": t, "many.rounds": 6 } })); }
    /* (#setup:<teams>:<role>:extra, Secret Stakes switched on with the Battle: what each game's line says, 21 Nov) */
    if (mode[3] === "extra" && typeof window !== "undefined" && !localStorage.getItem("qmb.setup.STKS")) localStorage.setItem("qmb.setup.STKS", JSON.stringify({ at: Date.now(), v: {
      "two.minis": ["flag", "closest", "auction", "see", "roulette", "battle", "stakes"] } }));
    const code = mode[3] === "xp" ? "XPXP" : rep ? "REPT" : mode[3] === "extra" ? "STKS" : "ABCD";
    /* (…:notv: the same Setup in a game with no TV, the game run on a phone) */
    return (
      <NoTv.Provider value={mode.includes("notv")}>
      <main className="screen">
        <footer className="mt-auto flex flex-col gap-2">
          {k > 2 ? <SetupMany code={code} k={k} busy={false} why="" tv={tv} onStart={() => {}} repeatOpen={mode[3] === "repo"} />
            : <Setup code={code} ready busy={false} why="" isHost={host} tv={host ? tv : undefined} timers={{}} onStart={() => {}} repeatOpen={mode[3] === "repo"} />}
        </footer>
      </main>
      </NoTv.Provider>);
  }
  if (!rec) return null;

  const { pub, secret } = rec, many = Array.isArray(pub.teams) && !("r" in pub);
  if (mode[0] === "tv") return <TvStage>{many ? <TvMany pub={pub} join={JOIN} host="Nour" />
    : <TvGame pub={pub} onExit={() => {}} onAgain={() => {}} join={JOIN} host={mode[1]?.startsWith("h.") || mode[1]?.startsWith("hw.") ? "Nour" : undefined} />}</TvStage>;

  const role = mode[1], noTv = mode[0] === "pn";
  const me = { room: "ABCD", user_id: "me", name: role === "host" ? "Nour" : role === "cap" ? "Rami" : "Maya", team: (role === "host" ? null : 0) as 0 | null,
    role: (role === "cap" ? "captain" : role === "host" ? "host" : "player") as never, avatar: null, joined_at: "" };
  const members = [me, { ...me, user_id: "x1", name: "Karim", role: "player" as never, team: 0 as const }, { ...me, user_id: "x2", name: "Lea", role: "captain" as never, team: 1 as 0 },
    { ...me, user_id: "x3", name: "Joe", role: "player" as never, team: 1 as 0 }];
  const send = () => {};
  /* Fool Me Twice, 3-8 teams: the captain's phone holds the lie it sent (team A's), so its picks leave it out and ask
     who'll fall for it, as in a real game */
  if (many && role === "cap" && pub.fool?.opts && typeof window !== "undefined") { const lie = secret?.typed?.[0]; try { if (lie) localStorage.setItem("qmb.fool.lie.ABCD." + pub.qid, lie); } catch { /* none */ } }
  return (
    <NoTv.Provider value={noTv}>
      <main className="screen split">
        <div className="side">
          <header className="flex items-center justify-between gap-3">
            <button type="button" className="chip me-chip"><span className="face">🙂</span><span className="truncate"><bdi>{me.name}</bdi></span></button>
            <span className="eyebrow whitespace-nowrap">ABCD</span>
          </header>
          {many ? <HudMany pub={pub} size="phone" me={me.team} host={role === "host"} /> : <Hud pub={pub} size="phone" me={me.team} />}
          {sideways && <div className="side-slot" ref={setSideSlot} />}
        </div>
        <SideSlot.Provider value={sideways ? sideSlot : null}>
        <div className="main">
          {many ? <PhoneMany pub={pub} me={me} code="ABCD" members={members} />
            : role === "host" ? <HostGame pub={pub} secret={secret} send={send} busy={false} />
            : role === "cap" ? <CaptainGame pub={pub} me={me} members={members} code="ABCD" />
            : <PlayerGame pub={pub} me={me} members={members} code="ABCD" />}
        </div>
        </SideSlot.Provider>
      </main>
    </NoTv.Provider>
  );
}
