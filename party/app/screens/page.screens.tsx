"use client";
/* The screen check's page (npm run screens, sim/screens/run.mjs): one screen from a simulated night, drawn as the
   game draws it, so a browser can measure it. Only there: the ".screens.tsx" ending makes it a page only when
   QMB_SCREENS=1 (next.config.mjs), so `npm run dev` and every deploy have no /screens.
     #tv:<key>              the TV (the 1280x720 stage)
     #ph:<role>:<key>       a phone with a TV in the room (role: host, cap, player)
     #pn:<role>:<key>       a phone with no TV
     #lobby:<teams>         the TV's lobby with 2 to 8 teams
   <key> is a screen kept by sim/screens/two.mjs or many.ts (sim/.out/screens/pubs.json, served by ./pubs). */
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
    if (h[0] === "lobby") return;
    void fetch("/screens/pubs").then((r) => r.json()).then((d) => {
      const r = d[h[h.length - 1]];
      if (r) setRec({ pub: shift(r.pub, Date.now() - r.now, r.now), secret: r.secret ? shift(r.secret, Date.now() - r.now, r.now) : {} });
    });
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
  if (!rec) return null;

  const { pub, secret } = rec, many = Array.isArray(pub.teams) && !("r" in pub);
  if (mode[0] === "tv") return <TvStage>{many ? <TvMany pub={pub} join={JOIN} host="Nour" seats={pub.teams.map(() => 3)} />
    : <TvGame pub={pub} onExit={() => {}} onAgain={() => {}} join={JOIN} host={mode[1]?.startsWith("h.") ? "Nour" : undefined} />}</TvStage>;

  const role = mode[1], noTv = mode[0] === "pn";
  const me = { room: "ABCD", user_id: "me", name: role === "host" ? "Nour" : role === "cap" ? "Rami" : "Maya", team: (role === "host" ? null : 0) as 0 | null,
    role: (role === "cap" ? "captain" : role === "host" ? "host" : "player") as never, avatar: null, joined_at: "" };
  const members = [me, { ...me, user_id: "x1", name: "Karim", role: "player" as never, team: 0 as const }, { ...me, user_id: "x2", name: "Lea", role: "captain" as never, team: 1 as 0 },
    { ...me, user_id: "x3", name: "Joe", role: "player" as never, team: 1 as 0 }];
  const send = () => {};
  return (
    <NoTv.Provider value={noTv}>
      <main className="screen split">
        <div className="side">
          <header className="flex items-center justify-between gap-3">
            <button type="button" className="chip me-chip"><span className="face">🙂</span><span className="truncate"><bdi>{me.name}</bdi></span></button>
            <span className="eyebrow whitespace-nowrap">ABCD</span>
          </header>
          {many ? <HudMany pub={pub} size="phone" me={me.team} host={role === "host"} /> : <Hud pub={pub} size="phone" />}
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
