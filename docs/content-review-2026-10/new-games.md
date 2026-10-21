# Two new mini-games: Drop the Pin and Guess the Airport

Feasibility notes and sample content for Thierry. Researched on 21 and 22 October 2026. The 40 sample legs are in `h_newgames.json`, next to this file (it parses with node: 40 legs, 7 easy, 7 medium and 6 hard per game).

**The short answer**

| Game | Build | Content | Legal risk | Recommendation |
|---|---|---|---|---|
| Drop the Pin | **Medium**: the phone pin needs real precision work | Easy: Wikidata gives the coordinates, Commons gives the photos | Low, if we host our own copies and keep a credits page | Build it on the Guess the Map world map, with deeper zoom and a draggable pin |
| Guess the Airport | **Easy**: it's a drawn board on the TV plus a typed answer | Medium: each board takes 10 to 15 minutes to check | Very low, if we draw the boards ourselves | Build it first. Draw the boards from checked route data and don't use photos. |

This isn't legal advice. It's what the licence texts and Wikimedia's own guidance say, with links.

---

## A1. Drop the Pin: feasibility

### Photos: can we get them free and legally? Yes.

**Wikimedia Commons is the best source.** Every file page states its author and licence, and the community tags legal problems such as missing freedom of panorama. All 20 sample photos come from Commons. I read each file page's licence templates on 21 October 2026 and checked every thumbnail by eye: each shows the right subject, in daylight, with no signs giving the answer away.

- **What the licences ask.**
  - **Public domain and CC0** (Neuschwanstein, Alhambra): no conditions. Commons still recommends crediting the source ([Reusing content outside Wikimedia](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia)).
  - **CC BY**: credit the creator, name the licence and link to it.
  - **CC BY-SA**: the same, plus ShareAlike, which only reaches an *edited* version of the photo.
  - Wikimedia says to credit "the content creator ... not the uploader", and to use the author's own wording when they give one. One example: the Baalbek photo asks for "© Vyacheslav Argenberg / http://www.vascoplanet.com/".
  - CC BY-SA 4.0 lets you meet these conditions "in any reasonable manner based on the medium, means, and context", for example with a link ([legal code §3(a)(2)](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en)). In practice: a **Credits screen** in the app, a `CREDITS.md` like the one in `public/flags/`, and ideally a one-line credit under the photo on the reveal screen.
- **Edits.**
  - Resizing and format conversion are technical modifications that "never produces Adapted Material" (§2(a)(4)), so a resized WebP is still the original work.
  - A **crop** is safest treated as an adaptation: say "cropped", keep the crop under the same CC BY-SA licence, and credit as before.
  - Showing a photo inside the game doesn't change the licence of the rest of the app. ShareAlike applies only to Adapted Material you share (§3(b)).
- **Is a private party app OK?** Yes. All of these licences allow commercial use too. The obligations kick in when you share the file publicly, and a hosted web app does that, so give credit anyway. It costs nothing.
- **Freedom of panorama (the real trap).** A photo of a *modern* building or sculpture can infringe the architect's or artist's copyright in countries without freedom of panorama ([Commons: Freedom of panorama](https://commons.wikimedia.org/wiki/Commons:Freedom_of_panorama)).
  - **France**: only a limited, non-commercial exception since 2016. The operator of the Eiffel Tower "claims copyright of images of the tower when lighted at night" ([Commons: France](https://commons.wikimedia.org/wiki/Commons:Copyright_rules_by_territory/France)). Use **daytime** Eiffel photos, which is what we have.
  - **UAE**: no freedom of panorama ([Commons: UAE](https://commons.wikimedia.org/wiki/Commons:Copyright_rules_by_territory/United_Arab_Emirates)). The Commons photo Wikidata uses for Burj Khalifa carries a "NoFoP-UAE" warning ([file](https://commons.wikimedia.org/wiki/File:Dubai_skyline_2015_(crop).jpg)), so I left Burj Khalifa out.
  - **Italy**: no freedom of panorama, but the Colosseum is ancient, so that's fine.
  - **US**: freedom of panorama covers "buildings only", not sculptures, so I left Mount Rushmore out.
  - **Australia and Brazil**: buildings are fine, so the Sydney Opera House is fine. Christ the Redeemer would be fine too.
  - **Rule of thumb**: ancient or pre-1900 monuments and natural sights are safe. For anything modern, check the Commons file page for a FoP or NoFoP tag.
- **Unsplash and Pexels** work but are second best.
  - **Unsplash**: free for commercial and non-commercial use, attribution optional. Images "cannot be sold without significant modification", and the licence excludes compiling images "to replicate a similar or competing service" ([Unsplash License](https://unsplash.com/license)). A quiz isn't a photo service, so that's fine.
  - **Pexels**: free, credit "not necessary". Don't sell unaltered copies, don't redistribute on other stock or wallpaper sites, and don't show identifiable people "in a bad light" ([Pexels License](https://www.pexels.com/license/)).
  - The downside of both: no community checks on freedom of panorama, and location tags you can't trust. Use them only to fill gaps.
- **Host our own copies.** Commons says hotlinking is "possible, but is not recommended" ([reuse guide](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia)). While researching I was rate-limited (HTTP 429) by Wikimedia several times; at a party that would mean a missing photo.
  - Download each file once and resize it to about 1600 px on the long side as WebP (roughly 150 to 300 KB).
  - Store it under a **meaningless file name**, as `public/fx` already does. Commons file names give the answer away, for example "Mont St Michel 3, Brittany, France - July 2011.jpg".
  - Preload it the way maps and flags are preloaded today.

### Coordinates: Wikidata, then a sanity check

- Wikidata's property P625 ("coordinate location") gives latitude and longitude for almost every landmark. Wikidata's structured data "is released into the public domain under Creative Commons Zero" ([Wikidata: Licensing](https://www.wikidata.org/wiki/Wikidata:Licensing)), so we can copy it freely. All 20 sample coordinates come from Wikidata, and the item is linked in each leg's `coords_source`.
- **Use the specific item, not the site.** Some items carry two coordinate points (Big Ben, Baalbek and Petra did). So I used *Al-Khazneh* (the Treasury) rather than *Petra*, and the *Temple of Bacchus* rather than *Baalbek*.
- Four decimal places is about 11 m, which is far more precise than any party needs.
- **Big things need one agreed point.** Iguazu Falls is 2.7 km wide and the Matterhorn sits on a border, so use the Wikidata point and say so on the reveal.

### Distance: haversine

- The standard formula is a = sin²(Δφ/2) + cos φ1 · cos φ2 · sin²(Δλ/2), then c = 2 · atan2(√a, √(1−a)), then d = R · c, with R = 6,371 km ([Movable Type](https://www.movable-type.co.uk/scripts/latlong.html)).
- Treating the earth as a sphere is off by "generally below 0.3%" (up to 0.55%). That's irrelevant here.
- Show distances rounded: "under 1 km", "14 km", "1,112 km". Call it a tie within 1 km.
- Distances on the sample legs, from the same formula:

| Leg | Wrong pin | Distance |
|---|---|---|
| Jeita Grotto | pin on Beirut | 14 km |
| Baalbek | pin on Beirut | 66 km |
| Petra | pin on Amman | 187 km |
| Chichén Itzá | pin on Mexico City | 1,112 km |
| Moai | pin on Santiago | 3,751 km |

### The map on the phone

- **Option A: the world map Guess the Map already uses.** This is the recommended option.
  - It's Natural Earth 1:10m. Natural Earth says "All versions of Natural Earth ... are in the public domain" and "Crediting the authors is unnecessary" ([terms](https://www.naturalearthdata.com/about/terms-of-use/)).
  - It's drawn in d3's naturalEarth1 projection (`maps-geo.js`, `index.html` `mapNE1`), with no labels. That matters: a labelled map would give away the "place it precisely" legs.
  - It works offline and the enlarged-map pinch zoom already exists (`components/MapView.tsx`).
  - **Work needed:**
    - Turn a tap into latitude and longitude. naturalEarth1 has no closed-form inverse, so it takes a few Newton steps (d3-geo has one).
    - Zoom deeper than today's `Z_MAX = 6`.
    - Draw both pins, the true spot and lines on the TV reveal.
- **Option B: OpenStreetMap tiles.** Not recommended.
  - OSM data is ODbL and needs a visible credit ([copyright](https://www.openstreetmap.org/copyright)).
  - The public tile server's policy requires an identifying User-Agent and a valid Referer, and forbids bulk download, prefetching and offline use.
  - It offers "no SLA or guarantee", and the policy warns that access can be blocked without notice ([tile policy](https://operations.osmfoundation.org/policies/tiles/)).
  - Worse for this game, the tiles are labelled with city names and even landmark names, which does the work for the players.
  - Label-free tiles from a commercial provider, or self-hosted tiles, are possible but add accounts, quotas or a build pipeline. I didn't price these.
- **Precision is the hard part.**
  - On a phone about 380 px wide, the whole world is roughly 105 km per pixel. A fingertip covers about 40 px, my estimate, so a tap at 1x zoom is only good to about ±2,000 km.
  - At today's 6x zoom it's about ±350 km. You need roughly 40 to 60x for ±40 km.
  - The SVG uses whole-number coordinates on a 10,000-unit width, so 1 unit is about 4 km. It stays crisp to about that zoom.
  - So the phone needs:
    - deep pinch zoom;
    - a **draggable pin** placed above the finger, ideally with a magnifier;
    - a **Confirm** button.
  - An alternative is two taps: pick a region, then place the pin on a zoomed regional map.

### What's hard, and the risks

- **Unfair or ambiguous legs.**
  - **Look-alikes.** The Iguazu and Victoria Falls aerial shots resemble each other: don't deal both in one game, or deal them deliberately as a pair. Replicas exist too (Liberty statues in Paris, an Eiffel Tower in Las Vegas), so use photos that show the setting.
  - **Photos that show nothing local.** A cave photo alone is too vague, so show the **name** for Jeita Grotto. A good rule: easy and medium legs show the photo only, hard legs show the photo plus the name, and the leg is about placing it.
- **Give-aways.** Visible signs, watermarks, the file name in the image URL, the image's alt text. Strip them all.
- **Small screen.** See precision above. The TV has room for the full reveal; the phone needs the pin UI.
- **Antimeridian.** Pacific legs such as Easter Island at −109° are fine on a map centred on Greenwich. Fiji or Tonga would sit on the map's edge, so avoid them or add a Pacific-centred view. Haversine itself has no problem with the wrap.
- **Copyright.** Low with Commons plus credits plus freedom-of-panorama care (above).

**Verdict: medium.** The content and the legal side are easy. The pin-placing UI on the phone and the TV reveal are a few days' work. I'd recommend it, built on the existing map.

---

## A2. Guess the Airport: feasibility

### Photos of real boards? No. Draw our own.

- A photo of a board is the photographer's copyrighted work.
  - Commons does have freely licensed board photos ([Category:Departure boards](https://commons.wikimedia.org/wiki/Category:Departure_boards), [Category:Flight information displays](https://commons.wikimedia.org/wiki/Category:Flight_information_display_systems)).
  - But they're random, often blurry, years out of date, and you can't change their difficulty. Airport and airline logos on them are trademarks.
- **Drawing our own board is the clean route.**
  - **The facts.** City names, flight numbers, times and statuses are facts and short phrases. The US Copyright Office lists "Names, titles, and short phrases" among things copyright does not protect, and says copyright "does not protect typeface" ([Circular 33](https://www.copyright.gov/circs/circ33.pdf)). Font *files* are licensed software, so use an open font. The US Supreme Court rejected protecting mere "sweat of the brow" fact-gathering ([Feist v. Rural](https://en.wikipedia.org/wiki/Feist_Publications,_Inc._v._Rural_Telephone_Service_Co.)).
  - **The EU database right.** The EU protects investment in databases against copying "substantial parts" ([Database right](https://en.wikipedia.org/wiki/Database_right)). So don't bulk-copy a commercial schedule database. Hand-picking eight routes per airport from public pages is fine.
  - **The look.** A generic split-flap or LCD style is fine. Don't copy one airport's exact branded design or its logos.

### Where route data comes from

- **OpenFlights: not for routes.** The data is under the Open Database License (ODbL), but the route data provider "ceased providing updates in June 2014" and the data "is of historical value only" ([OpenFlights data](https://openflights.org/data.php)).
- **OurAirports: for airport facts only.** Its data is public domain (the repository's LICENSE is the Unlicense) and regenerated daily ([data repo](https://github.com/davidmegginson/ourairports-data)). It covers airports, runways, frequencies, countries and regions. It has **no routes or airlines**.
- **Wikipedia airport articles, "Airlines and destinations": the best free source.**
  - They're current, cited, and mark routes as *Seasonal*, *begins*, *ends*, *resumes* or *suspended*.
  - We take only facts from them, not text.
  - **Caveat: edit wars.** On 19 October 2026 the Beirut article's table was cut in a "large cleanup" of unsourced content. MEA now shows only two destinations, Amsterdam and Berlin, against about 30 the day before ([page history](https://en.wikipedia.org/w/index.php?title=Beirut%E2%80%93Rafic_Hariri_International_Airport&action=history), [last revision before the cleanup](https://en.wikipedia.org/w/index.php?oldid=1380994630)).
  - So cross-check with the other end of the route, which I did: the Heathrow, Paris, Athens, Istanbul, Dubai and Geneva tables all list MEA to Beirut.
- **Airport websites.** Beirut's official live board lists today's departures in Arabic and English, with real flight numbers ([beirutairport.gov.lb](https://www.beirutairport.gov.lb/_flight.php)). The sample Beirut board is copied straight from its 22 October list. Many airline sites block automated reading; MEA's returned HTTP 403.
- **How accurate does it need to be?** A board of real routes with real airline codes is enough.
  - Times, gates and flight numbers can be plausible inventions. Daily schedules aren't needed and would go stale anyway.
  - Use only year-round routes, skipping anything flagged seasonal, begins, ends or suspended.
  - Store a "checked on" date per leg and re-check once a year.
  - Routes do move: Lufthansa's Munich–Istanbul flight "ends 25 October 2026", Swiss's Zurich–Beirut flight is "suspended until 24 October 2026", and Air France left Orly in March 2026 except for its Corsica flights ([Orly Airport](https://en.wikipedia.org/wiki/Orly_Airport)).
- **How the sample boards were checked.** I parsed the live Wikipedia tables on 21 October 2026 and checked all **160 rows** by script. For each row, the airline must be listed at that airport, with the destination in its **year-round** list and no begins, ends, resumes or suspended note. All 160 passed. The Beirut rows were checked against the airport's own board and the pre-cleanup revision.

### Board words in each language

**How each word was checked:**

- ★ = I saw it on a real airport page or board.
- ✓ = the meaning was checked on Wiktionary (en.wiktionary.org/wiki/&lt;word&gt;).
- ~ = my own knowledge, not checked. Have a native speaker look before using it.

The sample boards only use ★ and ✓ words, with a few ~ phrases noted below the table.

| Language | Departures | On time | Delayed | Cancelled | Boarding | Gate | Extra |
|---|---|---|---|---|---|---|---|
| German | Abflug ★✓ ([Munich Airport](https://www.munich-airport.de/abflug)) | Pünktlich ✓ | Verspätet ✓ (Verspätung ✓) | Annulliert ✓ (annullieren) | Boarding ~ (English loanword used on German boards) | Flugsteig ✓ / Gate ~ | Gate offen ~ |
| French | Départs ✓ | À l'heure ✓ | Retardé ✓ (retarder) | Annulé ✓ (annuler) | Embarquement ✓ | Porte ✓ | Dernier appel ~ (appel ✓) |
| Spanish | Salidas ✓ | A tiempo ✓ | Retrasado ✓ | Cancelado ✓ | Embarcando ✓ (embarcar) / Embarque ✓ | Puerta ✓ | Última llamada ~ (llamada ✓) |
| Italian | Partenze ✓ (partenza) | In orario ✓ | In ritardo ✓ (ritardo) | Cancellato ✓ | Imbarco ✓ | Uscita ✓ | Ultima chiamata ~ |
| Portuguese | Partidas ✓ | a horas (PT) ~ / no horário (BR) ~ | Atrasado ✓ | Cancelado ✓ (cancelar) | Embarque ✓ | Porta (PT) ✓ / Portão (BR) ✓ | Última chamada ~ (chamada ✓) |
| Dutch | Vertrek ✓ | Op tijd ~ | Vertraagd ✓ (vertraging) | Geannuleerd ✓ (annuleren) | Instappen ✓ | Gate ~ | Gate gesloten ~ |
| Arabic | المغادرة ★ (Beirut board) | في الموعد ~ (موعد ✓ "appointed time") | متأخرة ✓ (متأخر) | ملغاة ★ (Beirut: "ملغاة بتاريخه" = cancelled for today), ملغى ✓ | صعود الطائرة ~ (صعود ✓) | بوابة ✓ | تم اغلاق البوابة ★ = gate closed |
| Turkish | Kalkış ★✓ ([Istanbul Airport](https://www.istairport.com/tr)) / Dış Hatlar Gidiş ~ | Zamanında ✓ | Gecikmeli ~ (gecikme ✓) | İptal ✓ | Biniş ✓ | Kapı ✓ | Son çağrı ~ (çağrı ✓) |
| Greek | Αναχωρήσεις ✓ (αναχώρηση) | Στην ώρα ~ (ώρα ✓) | Καθυστέρηση ✓ | Ακυρώθηκε ~ (ακυρώνω ✓) / Ακύρωση ✓ | Επιβίβαση ✓ | Έξοδος ✓ / Πύλη ✓ | Τελευταία κλήση ~ (κλήση ✓) |
| Japanese | 出発 ★✓ ([Narita](https://www.narita-airport.jp/ja/flight/)) | 定刻 ✓ | 遅延 ✓ | 欠航 ✓ ("cancellation of a flight") | 搭乗中 ~ (搭乗 ✓) | 搭乗口 ✓ | |
| Chinese | 出发 / 出發 ✓ | 准点 / 準點 ✓ | 延误 / 延誤 ✓ | 取消 ✓ | 登机 / 登機 ✓ | 登机口 / 登機口 ✓ | |
| Korean | 출발 ✓ | 정시 ✓ | 지연 ✓ | 결항 ~ | 탑승 ✓ (탑승중 ~) | 탑승구 ✓ | |
| Russian | Вылет ✓ | По расписанию ~ | Задерживается ✓ (задерживаться) | Отменён ~ (отменить ✓) | Посадка ✓ | Выход ✓ | |

A few ~ phrases do appear on the sample boards, all common phrasing: Dutch "Op tijd", Greek "Στην ώρα", Japanese "搭乗中", German "Gate offen", and the Arabic "في الموعد" and "صعود الطائرة". On the Portuguese board, flights that are on time have a blank status, as on real boards (Beirut's board leaves future flights blank too).

### The clues, and how the levels work

- **The levers:**
  - **Board language** (strongest).
  - **Home airline code**: ME = Middle East Airlines, LH = Lufthansa, EK = Emirates, SQ = Singapore Airlines, KL = KLM, LX = Swiss, and so on.
  - **The missing city**: you can't fly to yourself, so put the rival hub on the board, for example Munich on the Frankfurt board.
  - **Local exonyms** (Laibach, Rom, Beyrouth, Beiroet).
  - **The airline mix**: low-cost and leisure carriers versus flag carriers and long-haul.
  - **The time zone**: the TV can show the airport's local time in the board's corner, so at a party in Beirut, a board showing two hours earlier suggests the UK.
- **Easy**: the language plus the home airline give it away.
- **Medium**: the language gives a region, but you need the airline or the missing city, or English with a home airline.
- **Hard**: a second airport of a city, or an English board with no home airline.
- **Scoring**: on easy and medium legs the city is enough (CDG takes "Paris"). On hard legs only the exact airport counts, so Orly does not take "Paris". The `accept` list in each leg reflects this.

### What's hard, and the risks

- **Ambiguous cities.**
  - London has six airports, and Paris, Istanbul, Tokyo, New York and Milan have two or more.
  - Basel-Mulhouse is a French, Swiss and German airport in one, so avoid it.
  - Eight rows can't prove which city is missing. Always include the obvious rival so the logic works.
- **Stale data.** See above. Keep a check date and re-check yearly.
- **Sensitive routes.** Middle East routes get suspended or cancelled during conflicts; the Beirut board on 21 October showed several cancellations. With this audience, don't put "Cancelled" on Beirut or Tel Aviv flights and don't pair contentious destinations. The samples follow this rule.
- **Fonts and scripts.**
  - Arabic is right-to-left, and Greek, Arabic and Japanese need their own font files. Don't rely on the TV's browser having them.
  - Ship open web fonts, such as the Noto family, which I didn't check for this note. Subset the Japanese font, because the full file is several MB.
- **Copyright.** Very low with drawn boards and no logos.

**Verdict: easy.** It's a styled table on the TV plus the typed answer and fuzzy match the app already has. The work is curating boards, about 10 to 15 minutes each with the checks above. I'd recommend building it first.

---

## B. The 40 sample legs

All 40 are in `h_newgames.json` in the format you specified, plus a few extra fields:

- **Pins:** `credit` (the exact attribution to show) and `coords_source` (the Wikidata item).
- **Airports:** `board_title` (the header in the board's language), `accept` (answers the app should take) and `source` (pages used to check the routes).

**Drop the Pin**

| Level | Landmarks (licence) |
|---|---|
| Easy | Eiffel Tower (CC BY-SA 3.0), Statue of Liberty (CC BY-SA 4.0), Colosseum (CC BY-SA 4.0), Sydney Opera House (CC BY-SA 4.0), Taj Mahal (CC BY-SA 3.0), Great Pyramid of Giza (CC BY 2.5), Big Ben (CC BY-SA 4.0) |
| Medium | Machu Picchu (CC BY-SA 3.0), Petra's Treasury (CC BY-SA 3.0), Angkor Wat (CC BY-SA 3.0), Neuschwanstein (CC0), Temple of Bacchus, Baalbek (CC BY 4.0), Alhambra (CC0), Iguazu Falls (CC BY-SA 4.0) |
| Hard | Jeita Grotto (CC BY 2.0, show the name), Moai of Ahu Tongariki (CC BY 2.5), Chichén Itzá (CC BY-SA 4.0), Mont-Saint-Michel (CC BY-SA 3.0), Matterhorn (CC BY-SA 3.0), Victoria Falls (CC BY-SA 4.0) |

Middle East: Pyramids, Petra, Baalbek and Jeita.

**Guess the Airport**

| Level | Airports (board language, giveaway) |
|---|---|
| Easy | Beirut BEY (Arabic/English, MEA; every row is real, from the airport's 22 October board), Madrid MAD (Spanish, Iberia), Lisbon LIS (Portuguese, TAP), Athens ATH (Greek, Aegean), Istanbul IST (Turkish, Turkish Airlines), Amsterdam AMS (Dutch, KLM), Dubai DXB (Arabic/English, Emirates) |
| Medium | Frankfurt FRA (German, Lufthansa, Munich listed; your reel's Laibach, Rom, München and DE flights), Munich MUC (its mirror, so deal FRA and MUC as a pair), Zurich ZRH (German but Swiss), Brussels BRU (French and Dutch side by side), Paris CDG (French, Air France long-haul), Singapore SIN (English, SQ and Scoot), Geneva GVA (French, but Paris is on the board) |
| Hard | Paris Orly ORY, London Gatwick LGW, London Heathrow LHR (the two London boards make a natural pair), New York JFK, Tokyo Haneda HND, Istanbul Sabiha Gökçen SAW (the twin of the easy IST board) |

---

## What I couldn't verify

- **Flight numbers, times and gates** are plausible inventions, except on the Beirut board, which is real. A few Beirut-bound numbers elsewhere (ME 202 from London, ME 212 from Paris, EK 957 from Dubai, TK 830 from Istanbul) match flights arriving on Beirut's 22 October board, with departure times set to fit. **Routes and airline codes are verified; numbers are not.**
- **MEA's own route list**: its website blocks automated reading. The Beirut routes rest on the airport's live board, the pre-cleanup Wikipedia revision and the other-end tables instead.
- **The ~ words** in the language table, which are common phrases I didn't find on a dictionary page or a live board. The Portuguese word for "on time" is left blank on the board.
- **Finger-precision figures** are my estimates, not a measured study.
- **Label-free commercial map tiles**: I didn't price or test them.
- **The Noto fonts' licence**: I named them as an option without checking.
- **The web-search budget ran out** partway through. Everything above was checked by fetching the named pages directly, but I couldn't run broader searches, for example for Unsplash's full long-form terms or airline timetables.
