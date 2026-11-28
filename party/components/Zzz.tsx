"use client";
/* ASLEEP (28 Nov, the owner: "create our own zzz", not the phone's emoji): three Z's in the game's gold, the smallest
   first, rising from the bottom left to the top right, each with a dark outline so it reads on any card; they drift up
   and fade in turn, like a sleeper's breath. For anyone in the lobby whose phone the TV hasn't heard from. Motion off:
   they stand still. size: the box's height in px (it's square). */
export function Zzz({ size = 22, label = "away" }: { size?: number; label?: string }) {
  return (
    <svg className="zzz" width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={label}>
      <defs><linearGradient id="zzzg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff2b8" /><stop offset="1" stopColor="#f5c518" /></linearGradient></defs>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {[[3, 19, 9], [11, 10, 8], [19, 2, 10]].map(([x, y, s], i) => (
          <g key={i} className={"z z" + i}>
            <path d={`M${x} ${y}h${s}l-${s} ${s}h${s}`} stroke="#15172a" strokeWidth={i === 2 ? 5 : 4.4} />
            <path d={`M${x} ${y}h${s}l-${s} ${s}h${s}`} stroke="url(#zzzg)" strokeWidth={i === 2 ? 2.6 : 2.2} />
          </g>))}
      </g>
    </svg>);
}
