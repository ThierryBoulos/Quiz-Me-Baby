# Commercial phase: everything to do (or check) before charging money

The parking spot for work that waits until Quiz Me Baby becomes a product: paid, public, with strangers'
data. Today it is a free game for friends: anonymous sign-ins, no accounts, no payments, no AI at runtime. So
much of this list doesn't apply yet, and some of it may never apply. Keep adding to it; don't delete an item,
mark it "not needed" with a date and a reason.

Status words: **todo**, **doing**, **done (date)**, **not needed (date, why)**.

---

## 1. The security check (run it first, and again before every release)

The owner's 7-door security prompt, saved word for word (5 Nov 2026). Run it at the start of the commercial
phase, then before every release and after every big change made by AI. Its step 5 creates `SECURITE.md` with
a one-command re-run; that file doesn't exist yet.

> Tu es mon expert en sécurité. Mon appli a été codée en partie avec l'IA. Je veux que tu vérifies les 7 portes qu'un attaquant ouvre en quelques minutes, puis que tu les fermes avec moi.
> Les 7 portes : 1. ce que le navigateur montre, 2. la clé d'IA, 3. la sécurité ligne par ligne (RLS), 4. à qui appartient chaque donnée, 5. l'espace admin, 6. les limites à l'inscription, 7. le webhook de paiement.
>
> CE QUE JE PENSE AVOIR FERMÉ
> Je ne sais pas ce qui est fermé : pars du principe que tout est ouvert.
> Pas fermé ou pas sûr : 1. ce que le navigateur montre, 2. la clé d'IA, 3. la sécurité ligne par ligne (RLS), 4. à qui appartient chaque donnée, 5. l'espace admin, 6. les limites à l'inscription, 7. le webhook de paiement.
> Ne me crois pas sur parole : vérifie les 7, même celles que je pense avoir fermées.
>
> ÉTAPE 1. COMPRENDRE MON APPLI
> Lis le projet avant de toucher à quoi que ce soit : le langage et le framework, où tourne le serveur, la base de données et son outil (Supabase, Firebase, Postgres…), l'authentification, le paiement, les appels à l'IA. Résume-moi tout ça en quelques lignes et pose-moi tes questions s'il manque quelque chose (adresse de l'appli en ligne, compte de test, fournisseur de paiement).
>
> ÉTAPE 2. VÉRIFIER LES 7 PORTES, SANS RIEN MODIFIER
> Pour chaque porte, donne un état (fermée, entrouverte, ouverte) avec la preuve : le fichier et la ligne, ou la requête qui montre le problème.
> 1. Ce que le navigateur montre : ouvre le code envoyé au navigateur (bundle, cartes de code source, réponses réseau) et liste tout secret, clé, adresse interne ou donnée d'un autre utilisateur qui y apparaît.
> 2. La clé d'IA : cherche toute clé d'API dans le code client, les variables publiques (NEXT_PUBLIC_, VITE_…) et l'historique Git ; déplace les appels à l'IA côté serveur ; si une clé a fuité, dis-moi de la révoquer et d'en créer une nouvelle.
> 3. La sécurité ligne par ligne (RLS) : pour chaque table, vérifie que la RLS (ou les règles de sécurité de ma base) est activée et que les règles limitent lecture et écriture au propriétaire ; teste avec un deuxième compte.
> 4. À qui appartient chaque donnée : pour chaque route qui reçoit un identifiant (facture, commande, profil, fichier), vérifie côté serveur que l'objet appartient à la personne connectée ; essaie l'identifiant d'un autre compte.
> 5. L'espace admin : vérifie que /admin et toutes les actions d'administration exigent une session et un rôle admin contrôlés côté serveur, y compris les routes d'API appelées par ces pages.
> 6. Les limites à l'inscription : vérifie les limites sur l'inscription, la connexion et l'envoi d'e-mails (par adresse IP et par minute), la vérification de l'e-mail avant tout crédit gratuit, et un plafond de dépense d'IA par compte.
> 7. Le webhook de paiement : vérifie que le webhook de paiement contrôle la signature avec le secret du fournisseur, refuse les événements non signés ou trop vieux, et ne traite pas deux fois le même événement.
> N'attaque jamais une appli qui n'est pas la mienne. Pour les tests réels, utilise mon environnement de test ou mes comptes de test, jamais les données de vrais clients.
>
> ÉTAPE 3. LE RAPPORT
> Donne-moi un tableau : porte, état, risque concret pour moi (argent, données de clients, réputation), et correction proposée. Classe du plus grave au moins grave. Attends mon accord avant de corriger.
>
> ÉTAPE 4. FERMER LES PORTES
> Corrige une porte à la fois. Pour chacune : écris d'abord un test qui prouve que la porte est ouverte, corrige, puis relance le test pour prouver qu'elle est fermée. Si une clé a fuité, rappelle-moi de la révoquer chez le fournisseur : la supprimer du code ne suffit pas.
>
> ÉTAPE 5. GARDER LES PORTES FERMÉES
> Crée un fichier SECURITE.md avec l'état des 7 portes et les tests à relancer, et une commande simple pour tout relancer. Je relancerai ce prompt avant chaque mise en ligne et après chaque grosse modification faite par l'IA.
>
> RÈGLES
> - Aucune clé ni aucun mot de passe en clair dans le code, les prompts ou ce rapport.
> - Ne supprime aucune donnée et ne touche pas à la production sans mon accord.
> - Explique chaque problème simplement, sans jargon.

### Where each door stands today (a first look, 5 Nov 2026, not the full check)

| Door | Today | What changes when it's a product |
|---|---|---|
| 1. What the browser shows | (5 Nov: no source maps in the production build, checked; a map's answer drawing and 3-8 teams' question ids no longer reach phones early.) Only the public Supabase address and its public key are in the browser, which is normal. `public/bank.json` has no answers; the full bank is served by `/api/bank` on the server. In a no-TV game the referee phone holds the answers (decision 1 in the Nov audit). | Check source maps are off in production; full fix for decision 1 (judge answers on the server). |
| 2. The AI key | No AI is called while playing; no AI key anywhere in the app. | Applies only if a paid feature uses AI (question writing, hints). Then: server side only, a spending cap per account. |
| 3. Row-level security (RLS) | On for every table; rules tie rows to room membership. The Nov security review found 17 issues, none critical (see §2 below). | Re-test with two real accounts; add paid tables (accounts, purchases) with owner-only rules. |
| 4. Who owns each piece of data | Rooms, seats and answers are checked by membership in the database functions. Known gaps: a referee seat can be taken, rooms can be guessed by code (§2). | Every route that takes an id (account, purchase, saved night) checks the owner on the server. |
| 5. Admin area | There is no admin area. Content is edited in the repo. | If one is added (content, refunds, users): server-checked admin role on every page and API route. |
| 6. Sign-up limits | Anonymous sign-ins only, 300 per hour per internet address (raised for parties on one Wi-Fi). No e-mails, no free credits. | Real accounts: limits on sign-up, log-in and e-mails per address per minute; e-mail confirmed before any free credit. |
| 7. Payment webhook | No payments. | Signature checked with the provider's secret, old or unsigned events refused, each event handled once. |

---

## 2. Security findings parked from the Nov 2026 review

From the 4 Nov assessment (security reviewer). None are critical for a game among friends; all matter once
strangers play. Details, file and line: the security section of the audit page
(https://claude.ai/artifact/Q5HCTgBJxN6R6gNJHxmxTZ). Some may move into the waves if the owner accepts them
there; then mark them here with the wave.

- **todo**: Answers held by the referee phone in no-host games (decision 1): full fix is judging on the server.
- **done (5 Nov 2026)**: A member can break every captain's suggestion inbox with one bad row (actions read rule casts a number).
- **done (5 Nov 2026)**: The no-TV referee's seat can be taken from the join screen, stopping the game.
- **done (5 Nov 2026)**: The action log has no size or rate limit; one member can flood a room (8 KB a tap, 40 taps in 4 s a phone).
- **doing**: Live channels (presence, the Auction count) are open: fake presence or fake counts are possible. 5 Nov: presence now counts only the room's members; private channels still to do.
- **todo**: Anyone can try room codes and find live rooms (about 900,000 codes, no limit).
- **done (5 Nov 2026)**: The 6-digit TV take-over code has no attempt limit (now 5 tries).
- **todo**: Team changes and stepping down allowed mid-game.
- **todo**: Secret Stakes picks: keep them off other teams' phones entirely (a private row per team). Today every
  team's bet travels in the room's public view; each phone only draws its own team's, so it's hidden on screen but
  not from someone reading the room's data (11 Nov 2026).
- **todo**: What Do You See?: every phone gets the clear picture's file and blurs or zooms it on screen, so a player
  who opens the file by itself sees it clear (its name is a hash, so it doesn't say what it is). For a paid version:
  send only the step on screen (the TV renders each step as its own small file), or the clear file only at the reveal.

---

## 3. Everything else for the commercial phase

Some of these may not apply now or ever; they're here so nothing is forgotten.

### Money
- **todo**: Business model: one-off night pass, subscription, paid packs (themes, levels), free tier limits.
- **todo**: Payment provider (Stripe, app-store in-app purchase), refunds, invoices, VAT (EU sales).
- **todo**: Accounts: who pays (the host), what a guest needs (still nothing, ideally).

### Running costs and reliability
- **todo**: Supabase paid plan: the free tier has 5 to 28 s stalls the app works around; a product shouldn't depend on that.
- **todo**: Vercel plan and limits for commercial use (the free Hobby plan is not for commercial projects).
- **todo**: Error monitoring and uptime alerts; a status page or a "something's wrong" contact.
- **todo**: Backups and a restore test; what happens to saved nights.
- **todo**: Load: many parties at once (realtime connections and message quotas per plan).

### Legal and privacy
- **todo**: Privacy policy and terms; cookie / local storage notice where needed (EU: GDPR).
  - **doing (7 Nov 2026)**: a short "Data privacy" window at the foot of Settings (what is kept, where, for how long; copyright and credits). Still missing: a contact address for privacy requests, and terms.
- **todo**: What personal data is kept (names, team names, answers), for how long (nightly clean-up exists), deletion on request.
- **todo**: Age: party drinking themes (cocktails, Sexy Time); age gate or a family mode.
- **todo**: The name "Quiz Me Baby": trademark search; domain.
- **todo**: Imad (host photo and name in "Imad your MC"): written consent for commercial use, or a replacement.

### Content rights
- **todo**: Flags and landmark photos: check every licence allows commercial use (`party/public/flags/CREDITS.md`, `party/public/pins/CREDITS.md`).
- **todo**: Map data and the night-lights map: licence and attribution.
- **todo**: Brand names in questions (beers, logos, TV shows): fine as trivia, but no logos or images without rights.
  - **Checked online, 11 Nov 2026 (not legal advice; an hour with a lawyer before charging):**
    logo quiz apps are common on the App Store and say "fair use" in their listings; no court case found for or
    against one; the real risk is a brand asking a store or us to take a logo down. Simple text logos are free of
    copyright on Wikimedia Commons (still trademarks). Famous faces: free photos exist on Commons (copyright cleared
    with a credit), but the licence doesn't cover the person's own image rights; France asks for consent for
    commercial use and is easier on informational use; no case found about a trivia game.
  - **Decided (11 Nov, the owner):** use any pictures and logos wanted. One sentence in Settings' Copyright window
    gives the credit, says the game isn't associated with any brand, celebrity or person shown, and gives the
    contact for removal requests: Thierryboulos@hotmail.com. Each picture set stays removable on its own.
  - **todo (at launch):** replace that personal address with an official one (support@ or legal@ on the game's
    own domain) everywhere it appears: the Copyright window, the privacy contact, the terms.
- **todo**: Fact-check pass on the whole bank before selling it (wrong answers become complaints).

### Product
- **todo**: Abuse: rude team and player names in public rooms (filter, host can rename or remove).
- **todo**: Languages (French first?).
- **todo**: Accessibility pass (contrast, screen readers, text size).
- **todo**: App stores: keep it a web app, or wrap it.
- **todo**: Analytics (privacy-friendly): how many nights, which games, where people drop off.
- **todo**: Support: help page, contact address, feedback in the app.

### From the Nov 2026 audit page
- **todo**: Items the owner marks "Save for commercial phase" on the audit page get copied here when the owner
  says "read the audit".

---

## 4. The commercial plan (11 Nov 2026)

The owner's ideas with Claude's suggestions. **Decided (11 Nov, the owner):** who pays, the free and paid split
with both additions, the prices, and the credit line. Still to build: everything under "Technical pieces".

### Who pays, who signs in (decided 11 Nov)
- **The host pays; guests never pay and never sign in.** A guest scans the QR and plays, as today. Only the person
  who creates the room needs an account, and only to buy.
- **Sign-in for the buyer only:** an e-mail link (no password), or Google / Apple. The purchase belongs to that
  account; a room that account opens is a full room for everyone in it.
- A free room needs no account at all (as today).

### Free and paid (decided 11 Nov)
| | Free | Paid |
|---|---|---|
| Question rounds | Easy, Medium, Hard; 8 broad themes; one pair of questions per theme and level | Every theme, the niche ones too; Expert; the whole bank |
| Mini-games | 4 of them | All of them |
| Advanced | Locked | Difficulty per theme, own questions and themes |
| Seeing the bank | Never | Never (see "Protecting the bank") |

Also decided: **3 to 8 teams is paid** (bigger parties are where it's worth most); **the free pack is fixed**, so a
second free night repeats questions (the reason to buy). "Play without TV" stays free.

### Price (decided 11 Nov)
- **A night pass: $4.99**, the full game for 48 hours.
- **Lifetime: $25**, the full game for good.
- No monthly plan (a party game is used in bursts).

### Protecting the bank
- **Remove "Choose questions" as it is:** it shows any host every question and answer. In its place: a difficulty
  per theme, and "Add your own questions". Nobody browses the bank.
- **Locked content never leaves the server.** Today the TV downloads the whole bank with its answers. Instead:
  - the bank sits in a database table nobody's phone or TV can read (no read rule at all);
  - at Start, a server function deals tonight's questions plus 3 spares per game (for "Change question";
    the owner, 11 Nov), and the room gets only those; the TV asks the server for more if a night runs out;
  - answers stay on the server and the server judges (section 2, decision 1), so even tonight's answers never
    reach a phone before the reveal;
  - a cap of 10 rooms a day per account (or free player): generous, since people open a room, change their mind
    and open another, or switch devices (the owner, 11 Nov); enough to stop anyone harvesting the bank.
  Someone determined could still copy what they see, night by night: slow, and paid. That's as locked as a game
  people play can be.
- **Open Trivia DB questions** (decided 11 Nov): one credit line in the app's Copyright window ("Some questions
  are adapted from Open Trivia DB, opentdb.com."), nothing more.

### Technical pieces, in order
1. Deal and judge on the server (protects the bank; also closes section 2's first item).
2. Accounts for buyers (Supabase Auth: e-mail link, Google, Apple) and an "entitlements" table: who bought what,
   until when. Owner-only rules (door 3).
3. Payments through a merchant of record (Paddle or Lemon Squeezy handle EU VAT and invoices; Stripe alone
   leaves VAT to us). Web checkout, no app store, so no store commission. Webhook checks (door 7).
4. The free pack and the locks, enforced where the questions are dealt.
5. Paid hosting (Vercel Pro, Supabase Pro), error monitoring, backups.
6. Legal: terms, privacy contact, age notice, the name's trademark search, Imad's consent, image licences.
7. The 7-door security check (section 1), then launch.

### Launch and marketing, in a nutshell
1. Decide the split and the price above.
2. Protect the bank, clear the rights (steps 1 and 6).
3. Build accounts, payments and the free pack (steps 2 to 5).
4. A free beta with people who aren't friends: 10 to 20 real nights, watch where they get stuck.
5. A one-page site with a 30-second video of a real night, and the price.
6. Marketing that fits a party game: short videos of real nights (TikTok, Reels); every guest's phone ends the
   night with "Host your own night" (each party shows the game to 6 to 30 new people); bars and quiz hosts;
   the Lebanese diaspora for the Lebanon theme; dates that sell party games (New Year's Eve, Christmas, summer).
7. Measure nights played and free-to-paid; then languages (French, Arabic).
