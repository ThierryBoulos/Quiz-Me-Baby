/* A note on the TV: whole sentences, as many as fit in `max` characters, never cut mid-word ("OS is…", 11 Nov, the
   owner); the phones keep it all. Two teams and 3 to 8 alike. A sentence ends at . ! or ? before a space or the
   end, so "5.2 inches" stays whole; a first sentence longer than `max` comes whole all the same. */
export const wholeSentences = (t: string, max = 190) => {
  const parts = t.match(/.*?[.!?]+["'’”)]*(?:\s+|$)|.+$/gs) || [t];
  let out = "";
  for (const p of parts) { if (out && (out + p).trim().length > max) break; out += p; }
  return out.trim();
};
