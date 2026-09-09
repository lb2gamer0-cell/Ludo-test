# Ludo Game — Bug Fix Report

Poore project (26 code files) ka audit karke **80+ bugs** fix kiye gaye hain.
Har fix code me `// FIX:` comment ke saath likha hai, taaki aap dekh sakein kya badla.

---

## Session 3 Update (naye fixes)

### D. "Connecting..." hamesha atka rehta tha (login na hota tha, na fail hota)
Session 2 me back-button fix ke liye `signInWithPopup` use kiya tha. Real
device par ye popup dikhata tha, account select bhi ho jata tha, lekin
result kabhi wapas app tak pahuchta hi nahi tha (Android Chrome ki
third-party storage restrictions ki wajah se) - button "Connecting" par
hamesha ke liye atka reh jata tha. **Fix:** `signInWithRedirect` par wapas
laaye — ye ya turant navigate karta hai ya turant error deta hai, kabhi
"beech me atakta" nahi. Trade-off: back-button par Google ke apne
intermediate pages dikhna ek browser-level limitation hai jise koi bhi app
JS se poora hata nahi sakta - lekin harmless hai, kyunki dobara apni site
(index.html) tak pahunchte hi already-logged-in user turant game.html bhej
diya jata hai.

### E. Login page se Day/Night toggle hata diya
User request par login page (`index.html`) se theme switch button poori
tarah hata diya gaya hai.

### F. Guest profile me "Edit Profile" ki jagah ab "Login" button
Pehle dono buttons ek saath dikhte the aur linking popup-based tha (jo
Connecting-bug ka shikaar tha). Ab: Guest account ke profile me "Edit
Profile" chhup jata hai, usi jagah "🔑 Login" button dikhta hai — dabane par
seedha login page (`index.html`) par le jata hai, jahan wahi reliable
redirect-based Google login use hoke guest ka data (coins/diamonds/level)
usi Google account me upgrade ho jata hai (agar wo Gmail pehle se kisi aur
account se juda na ho).

### G. Goti (token) visuals — professional 3D look
- Har goti ke niche ab ek permanent halki 3D elliptical shadow disc hai
  (pehle sirf movable tokens ko koi base milta tha) - lagta hai goti
  zameen par khadi hai.
- Movable token ki highlight ring ab ek 3D-tilted, continuously ghoomti hui
  "spinning disc" hai (conic-gradient + perspective/rotateX) - jaise sikka
  goti ke peeche se ghoom kar aa raha ho.
- Goti ka "ground touch point" ab box ke exact center par align hota hai
  (pehle bounding-box ka geometric center use hota tha, jisse pawn art
  top-heavy hone ki wajah se goti thodi upar-chadhi hui dikhti thi).

---

## Session 2 Update (naye fixes)

### A. Back button purane Google login screens par le jata tha
`auth-manager.js` `signInWithRedirect()` use karta tha, jo poore page ko Google
ke account-picker par navigate kar deta tha. Wo pages browser history me reh
jate the — login ke baad back dabane par user unhi purane cached screens par
wapas pahunch jata tha. **Fix:** ab `signInWithPopup()` use hota hai (page kabhi
navigate hi nahi hota), aur sirf popup block hone par hi redirect par fallback
hota hai.

### B. Back button "app jaisa" clean nahi tha (sirf native app me kaam karta tha)
`initNativeBackButton()` sirf Capacitor native build me chalta tha. Normal
Chrome browser me back button seedha page/history navigate kar deta tha.
**Fix:** `initBrowserBackGuard()` naya function - browser me bhi back press
pehle open modal/view ko app jaisa band karta hai (profile → setup → game
exit-confirm), tabhi asli page chhodta hai.

### C. Guest account ko Google se link karne ka koi tarika nahi tha
Guest se khela user apna progress kisi doosre device par le jaane ke liye
Google se connect nahi kar sakta tha. **Fix:**
- Naya backend endpoint `POST /api/account/upgrade-guest` — guest ke
  coins/diamonds/level preserve karke Google identity par upgrade karta hai.
- Agar us Gmail se pehle se koi ALAG account bana hua hai, to upgrade
  **block** ho jata hai (409 error, clear message ke saath) — do accounts
  galti se merge nahi hote.
- Profile modal me naya "🔗 Login with Google" button — sirf Guest accounts
  ko dikhta hai.

### Security note (naya audit se mila)
`backend/config.js` me fallback JWT_SECRET aur ADMIN_PASSWORD hardcoded hain
jo GitHub repo me public hain. Agar Render par `.env` variables (`JWT_SECRET`,
`ADMIN_PASSWORD`) set nahi kiye gaye, to koi bhi in values se admin token bana
sakta hai. **Render Dashboard → Environment** me ye do variables zaroor set
karein.

---

## Sabse bade bugs (game-breaking)

### 1. Lobby chhodne ke baad naya room ban hi nahi sakta tha
`server.js` me `socket.currentRoom` kabhi clear nahi hota tha. Ek baar lobby chhodne
ke baad hamesha `"Already connected to an active room."` aata tha — app restart hi
ekmatra rasta tha.
**Test result:** purane code me `BLOCKED: Already connected to an active room.` — fix ke baad `OK new room`.

### 2. Koi disconnect hota to poora match freeze ho jata tha
`handleLeave` har disconnect par turn timer clear kar deta tha, chahe jaane wala
current player ho ya na ho. Match hamesha ke liye ruk jata tha.
**Test result (3-player match, ek player disconnect):** purana code = 0 turn switches (frozen),
naya code = match chalta raha, server ne disconnected player ke liye auto-play kiya.

### 3. Entry fee do baar kat jati thi (double deduction)
- `host_start_game` me `status !== 'lobby'` ka guard nahi tha — host do baar START dabata to fee do baar katti.
- `startGame()` (frontend) friends mode me `deductCoinsFromUser()` bhi call karta tha, jabki server pehle hi kaat chuka hota tha.

**Test result:** purane code me host account `2500 → 1500` (500 do baar kata). Naye code me `2500 → 2000` (sahi).

### 4. Free coins farming / wallet spoofing
`wallet.js` agar user na mile to **naya account 2500 free coins ke saath bana deta tha**.
Client apna `username`/`mobile` khud bhejta tha, isliye koi bhi fake naam bhej kar
unlimited coins bana sakta tha — ya dusre ke wallet se bet laga sakta tha.

**Test result:** purane server ki DB me 5 nakli accounts (`a`, `b`, `c`, `p1`, `p2`) apne
aap ban gaye, har ek me free 2500 coins. Naye code me sirf 3 asli accounts, coins ka
total bilkul balanced (5000 in → 5000 out).

**Fix:** identity ab JWT token se verify hoti hai, aur unknown identifier par account nahi banta.

### 5. Har chaal ke baad ek turn skip ho jata tha
Client `handleServerMoveResult` me `nextTurn()` call karta tha **aur** server bhi khud
turn switch karta tha → double switch. Ab multiplayer me turn sirf server ka
`turn_switched` event badalta hai.

### 6. Multiplayer ka winner screen bilkul dikhta hi nahi tha
`match_finished` sirf `modal.style.display = 'flex'` karta tha, lekin CSS me overlay
`opacity: 0` aur sheet `translateY(100%)` hai jab tak `overlay-active` / `sheet-active`
class na lage. Screen invisible rehti thi aur uska body bhi khali hota tha.
Ab wahi `showWinnerScreen()` chalta hai jo solo mode me chalta hai.

### 7. Reconnect ke baad sabko GALAT color mil jata tha
`reconnect_success` me `currentGameMode = 'friends'` set nahi hota tha, isliye
`setupGameOrientation()` solo wali branch me chala jata tha. Ab server `yourColor`,
`gameType`, `betAmount` aur current turn bhejta hai.

### 8. Online match ke baad vs-Computer game freeze ho jata tha
`showMainMenu()` `window.isMultiplayerGame` / `currentRoomCode` reset nahi karta tha,
isliye agli offline game bhi server ko emit karti rehti thi.

### 9. Home column me goti ka `pos` galat reh jata tha (phantom capture)
`moveToken()` me stepCount 51–55 par `token.pos = -1` set nahi hota tha. Purani ring
wali position atki reh jati thi → ghar ke andar baithi goti bhi "kat" jati thi aur
client-server board desync ho jata tha.

### 10. Login par server ka jawab miss ho jata tha
`completeUserLogin` fetch ko sirf **800ms** baad abort kar deta tha. Mobile data par
jawab lagbhag hamesha miss hota tha, isliye localStorage me optimistic 5000/2500 coins
pade rehte the jabki server par asli balance kuch aur hota tha → "insufficient balance".
Ab 8 second ka timeout hai.

---

## Baaki fix ki gayi cheezein

**backend/server.js**
- Room code collision check (do rooms ka same code ban sakta tha)
- Color assignment ab first-unused-color se (pehle index se, lobby se koi nikalta to duplicate color milta)
- `request_server_token_move` me tokenIndex validate hota hai (koi bhi index bhej sakta tha)
- Turn switch ab forfeited + finish ho chuke players ko skip karta hai
- `turnSeq` guard — scheduled auto-switch aur client ka switch request ek saath chal kar turn double skip kar dete the
- Double payout guard (`payoutDone`) — winner ko prize do baar mil sakta tha
- Room delete hone par uske grace timers bhi clear hote hain (memory leak + baad me forfeit crash)
- Ek hi account do tabs se join nahi kar sakta
- Fee deduction ab atomic-ish: koi player fail ho to sabko refund
- Naya `board_sync` event — server ka authoritative board har turn ke baad
- Naya `your_color` event — client ab andaza nahi lagata
- `/api/health` endpoint, JSON body 100kb limit
- Signup bonus ab server decide karta hai (pehle client `coins` bhej sakta tha)
- `TURN_TIMEOUT_MS` / `DISCONNECT_GRACE_MS` ab `.env` se configurable

**backend/wallet.js / db.js**
- Ek shared `findUserKey()` — pehle 3 jagah alag-alag logic thi
- `adminModifyWallet` username badalne par duplicate record bana deta tha
- `saveUserRecord` purani key par hi update karta hai (pehle orphan record ban jata tha, coins gayab)
- Naya `refundMatchEntryFee()`
- Transactions array ab 5000 par cap (DB file infinite badhti thi)
- coins/diamonds kabhi NaN ya negative nahi ho sakte

**frontend**
- Move animation ka `setInterval` track hota hai — game exit karne par ruk jata hai (pehle chalta rehta tha aur error dega)
- Face-to-face me: dice roll ho chuka ho par goti na chali ho to timeout par auto-move (pehle turn hamesha ke liye atak jata tha)
- Multiplayer dice click par 8s safety timeout (server na bole to flags lock ho jate the)
- Server se aaye 6 par `sixCountThisTurn` ab badhta hai
- Jo player saari gotiyan ghar pahucha chuka hai use ab extra turn nahi milta
- Forfeit hone par us color ka `tokensState` bhi reset hota hai (pehle sirf DOM se hatti thi)
- Winner screen ab crash nahi karta (undefined name / 2 se kam players)
- Bot ki chaal par `solo-step` nahi bhejta (anti-cheat count galat hota tha)
- `deductCoinsFromUser` server reject karne par local deduction wapas kar deta hai
- Guest ID ab lamba random (pehle 4 digit — alag devices par same ID aur ek hi wallet share ho jata tha)
- `initUserSession()` do jagah se call ho raha tha
- Team Up mode ke baad 2P/3P buttons dead reh jate the
- Socket URL ab Acode/live-preview (port 7700) par bhi sahi backend par jata hai
- `connect_error` / `disconnect` par user ko status message dikhta hai

---

## Security note (zaroori)

`backend/config.js` me abhi bhi fallback values hain jo repo me likhi hain:
admin password `loki00` aur JWT secret. **Production par jane se pehle**
`backend/.env.example` ko copy karke `backend/.env` banayein aur `JWT_SECRET`
+ `ADMIN_PASSWORD` badal dein. `.env` ko kabhi git me commit na karein.

---

## Testing

Do automated simulation test chalaye gaye (asli socket.io clients, asli server):

| Test | Purana code | Naya code |
|---|---|---|
| 2-player match poora khelna | 0 moves, match stall | 23 moves, winner declared |
| Entry fee (host 2x start) | 2500 → 1500 (double cut) | 2500 → 2000 (sahi) |
| Nakli accounts bane | 5 phantom accounts, free coins | 0 |
| Coin conservation | — | 5000 in → 5000 out |
| Duplicate join block | nahi tha | blocked |
| Disconnect ke baad match | frozen (0 turn switches) | chalta raha |
| Lobby chhodne ke baad naya room | BLOCKED | OK |

Sabhi 16 JS files `node --check` se syntax-clean hain, aur server run me koi error nahi aaya.
