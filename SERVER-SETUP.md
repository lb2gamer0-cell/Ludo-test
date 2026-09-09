# Backend me kya add karna hai

Admin portal ek alag folder hai, lekin uska data aapke **Ludo backend** se hi aata hai.
Isliye backend me 2 cheezein add karni hain.

---

## Step 1 — `admin-routes.js` file copy karein

Is folder wali `admin-routes.js` ko apne project ke **`backend/`** folder me daal dein
(wahin jahan `server.js`, `wallet.js`, `db.js` rakhe hain).

```
backend/
├── server.js
├── wallet.js
├── db.js
├── dice-token.js
├── config.js
└── admin-routes.js   <-- ye add karein
```

---

## Step 2 — `server.js` me 3 chhote badlaav

### 2a. Sabse upar, baaki require ke saath:

```js
const { createAdminRouter } = require('./admin-routes');
```

### 2b. Routes wale hisse me (jahan aapke `app.get` / `app.post` likhe hain) ye add karein:

```js
app.use('/api/admin', createAdminRouter({
    rooms,               // aapka rooms Map
    io,                  // socket.io instance
    activeSoloMatches,   // solo matches Map
    destroyRoom: (code) => destroyRoom(code)
}));
```

> Agar aapke server.js me pehle se `app.post('/api/admin/update-wallet', ...)` likha hai,
> to use **hata dein** — ab wo admin-routes.js me hai.

### 2c. `/api/health` endpoint (login page ka "Test" button isi ko call karta hai):

```js
app.get('/api/health', (req, res) => {
    res.json({ success: true, uptime: process.uptime(), activeRooms: rooms.size });
});
```

---

## Step 3 — CORS (bahut zaroori)

Portal alag folder/port se chalta hai, isliye browser tabhi allow karega jab CORS on ho.
`server.js` me ye line honi chahiye:

```js
const cors = require('cors');
app.use(cors());
```

Agar `cors` install nahi hai:

```bash
cd backend
npm install cors
```

---

## Step 4 — Test karein

```bash
cd backend
node server.js
```

Browser me kholein: `http://localhost:3000/api/health`
Agar `{"success":true,...}` dikhe to backend taiyar hai.

Ab admin portal folder ki `index.html` kholein, Server URL me
`http://localhost:3000` daalein, **Test** dabayein — "✅ Connected" aana chahiye.

---

## Zaroori: portal ko `file://` se mat kholein

Agar aap `index.html` par double-click karte hain to URL `file:///...` hota hai.
Browser `file://` se API calls block kar deta hai (CORS policy).

**Sahi tarika** — portal folder me ek chhota server chalayein:

```bash
cd "ludo admin portal"
npx serve -l 8080
# ya
python3 -m http.server 8080
```

Phir kholein: `http://localhost:8080`

Spck Editor / Acode me "Run" ya "Live Preview" dabayenge to wo khud hi
`http://localhost:<port>` par serve kar dega — wo bhi theek hai.

---

## Step 5 — LIVE SYNC (admin ka change turant game me dikhe)

Bina iske bhi admin ke changes game me aayenge, lekin tabhi jab player
app dobara khole ya main menu par wapas aaye. **Turant** dikhane ke liye:

### 5a. `server.js` me — `io.on('connection', (socket) => {` ke turant baad:

```js
// ADMIN PORTAL LIVE SYNC: socket ko user ke personal channel me daalo
socket.on('identify_user', ({ authToken } = {}) => {
    try {
        if (!authToken) return;
        const decoded = jwt.verify(authToken, JWT_SECRET);
        const database = db.readDB();
        const key = db.findUserKeyIn(database, decoded.username)
                 || db.findUserKeyIn(database, decoded.mobile)
                 || db.findUserKeyIn(database, decoded.id);
        if (!key) return;
        socket.walletKey = key;
        socket.join('user:' + key);
    } catch (e) { /* invalid token - ignore */ }
});
```

> `db.findUserKeyIn` aapke `db.js` me exported hona chahiye. Agar nahi hai to
> `module.exports` me add kar dein.

### 5b. Frontend — `frontend/js/socket-manager.js`

Is package ke `frontend-patch/socket-manager.js` me sab pehle se laga hua hai.
Agar aap apni file rakhna chahte hain to teen cheezein add karein:

1. `socket.on('connect', ...)` ke andar sabse upar:
```js
const tk = localStorage.getItem('userToken');
if (tk && !tk.startsWith('offline_token_')) {
    socket.emit('identify_user', { authToken: tk });
}
```

2. Listener:
```js
socket.on('wallet_updated', (data) => {
    if (!data) return;
    try {
        const raw = localStorage.getItem('currentUser');
        if (!raw) return;
        const user = JSON.parse(raw);
        const oldCoins = Number(user.coins || 0);
        if (typeof data.coins === 'number') user.coins = data.coins;
        if (typeof data.diamonds === 'number') user.diamonds = data.diamonds;
        localStorage.setItem('currentUser', JSON.stringify(user));
        const c = document.getElementById('display-user-coins');
        const d = document.getElementById('display-user-diamonds');
        if (c) c.innerText = Number(user.coins || 0).toLocaleString();
        if (d) d.innerText = Number(user.diamonds || 0).toLocaleString();
        if (data.reason === 'admin' && typeof showCoinToast === 'function') {
            const diff = Number(user.coins || 0) - oldCoins;
            if (diff !== 0) showCoinToast(diff);
        }
    } catch (e) {}
});

socket.on('account_status_changed', (data) => {
    if (data && data.banned) alert('Aapka account ban kar diya gaya hai.');
});
```

3. `showCoinToast()` function — poora code `frontend-patch/socket-manager.js` me hai.

---

## Ban hone par player ko batane ke liye (optional)

`frontend/js/socket-manager.js` me socket listeners ke beech ye add kar dein:

```js
socket.on('admin_broadcast', (data) => {
    if (data && data.message) alert('📢 ' + data.message);
});

socket.on('admin_kicked', (data) => {
    alert((data && data.message) || 'Aapka account ban kar diya gaya hai.');
    localStorage.removeItem('active_multiplayer_room');
    if (typeof showMainMenu === 'function') showMainMenu();
});

socket.on('room_disbanded', (data) => {
    alert((data && data.message) || 'Match admin dwara band kar diya gaya.');
    window.isMultiplayerGame = false;
    window.currentRoomCode = null;
    localStorage.removeItem('active_multiplayer_room');
    if (typeof showMainMenu === 'function') showMainMenu();
});
```
