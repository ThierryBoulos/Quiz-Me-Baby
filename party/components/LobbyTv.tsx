"use client";
/* THE TV LOBBY in the marquee's look (the owner, 1 Nov): the room code in lit letter tiles, the QR code framed
   in gold, the sign small at the top; the teams under them, 2 to 8 (2 side by side, 3 or 4 in a row, 5-6 in two
   rows of 3, 7-8 in two rows of 4). Captains in gold with a C armband, first in their team; a team with players
   but no captain says so in a dashed gold chip. The lobby's own controls along the bottom. */
import type { ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { teamName, type Member, type Room } from "@/lib/room";
import { MANY_COLORS, LETTERS } from "@/lib/many/logic";
import { manyNames } from "@/lib/many/useTvMany";
import { CodeTiles, MqStage, Sign, useLights } from "./Marquee";

const colsOf = (k: number) => (k <= 2 ? 2 : k === 3 ? 3 : k === 4 ? 4 : k <= 6 ? 3 : 4);
/* the cells a team shows: six (two columns of three; one column of six for 4 teams), eight for 3 teams (four rows);
   a bigger team shows its last cell as "+N more" */
const roomFor = (k: number) => (k === 3 ? 8 : 6);

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
      <div className="teams" style={{ gridTemplateColumns: `repeat(${colsOf(k)}, minmax(0, 1fr))` }}>
        {names.map((name, t) => {
          const list = members.filter((m) => (m.team as number) === t).sort((x, y) => (x.role === "captain" ? -1 : 0) - (y.role === "captain" ? -1 : 0));
          const cap = list.find((m) => m.role === "captain"), cells = roomFor(k) - (cap || !list.length ? 0 : k === 4 ? 1 : 2);   // ("Needs a captain" takes a whole row)
          const shown = list.length > cells ? list.slice(0, cells - 1) : list, more = list.length - shown.length;
          return (
            <div key={t} className="team" style={{ ["--c" as string]: MANY_COLORS[t] }}>
              <div className="hd">
                <b><span className="dt">{LETTERS[t]}</span><span className="tn"><bdi>{name}</bdi></span></b>
                <span>{list.length} {list.length === 1 ? "player" : "players"}</span>
              </div>
              <div className="ppl">
                {list.length === 0 && <span className="none">Nobody yet</span>}
                {list.length > 0 && !cap && <span className="need">Needs a captain</span>}
                {shown.map((m) => (
                  <span key={m.user_id} className={"pop-in" + (m.role === "captain" ? " capt" : "")}>
                    {m.role === "captain" && <b className="arm" aria-label="Captain">C</b>}
                    <i>{m.avatar || "🙂"}</i><bdi>{m.name}</bdi>
                    {m.role === "captain" && away.includes(m.user_id) && <em className="away">away</em>}
                  </span>))}
                {more > 0 && <span className="more">+{more} more</span>}
              </div>
            </div>);
        })}
      </div>
      <div className="bar">
        <div className="bl">{status}</div>
        <div className="br">{controls}</div>
      </div>
    </div>);
}
