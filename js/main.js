import * as Rules from './rules.js';
import { BoardView } from './board.js';
import { DiceView } from './dice.js';
import { Sound } from './sound.js';
import * as FX from './fx.js';
import * as FS from './fullscreen.js';
import { icon, logoDice } from './icons.js';
import { diceName, upperTR, PHRASES, REACTIONS } from './names.js';
import { connectRoom, OfflineRoom, newRoomId, validRoomId, onlineAvailable, testMode, watchLobby, onlineCount, removeLobbyEntry } from './net.js';
import { THEMES, tableBG, checkerIcon, renderBoard } from './theme.js';

const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const other = Rules.other;
const THEME_KEYS = ['ceviz', 'sedef', 'gece'];

const store = {
  get(k, d) { try { const v = localStorage.getItem('tavla:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('tavla:' + k, JSON.stringify(v)); } catch (e) { /* gizli sekme */ } },
};

// Bu cihazın en son girdiği oyun (sayfa yenilenince sormadan geri dönmek için).
// Yerel testte her sekme ayrı oyuncu olduğundan sekmeye özel tutulur.
const lastRoom = {
  get() {
    try { return JSON.parse((testMode() ? sessionStorage : localStorage).getItem('tavla:son')); } catch (e) { return null; }
  },
  set(v) {
    try { (testMode() ? sessionStorage : localStorage).setItem('tavla:son', JSON.stringify(v)); } catch (e) { /* yok say */ }
  },
};

function clientId() {
  const make = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
  // yerel testte her sekme ayrı oyuncu olsun
  if (testMode()) {
    let t = sessionStorage.getItem('tavla:id');
    if (!t) { t = make(); sessionStorage.setItem('tavla:id', t); }
    return t;
  }
  let id = store.get('id');
  if (!id) { id = make(); store.set('id', id); }
  return id;
}

function themeSwatch(k) {
  const T = THEMES[k];
  const tri = (x, c) => `<polygon points="${x},4 ${x + 12},4 ${x + 6},26" fill="${c}"></polygon>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="58" height="30" viewBox="0 0 58 30" aria-hidden="true"><rect x="0" y="0" width="58" height="30" rx="5" fill="${T.frame.base}"></rect><rect x="3" y="3" width="52" height="24" rx="2" fill="${T.field.base}"></rect>${tri(5, T.tri[0].base)}${tri(17, T.tri[1].base)}${tri(29, T.tri[0].base)}${tri(41, T.tri[1].base)}<circle cx="11" cy="21" r="4.5" fill="${T.w.base}" stroke="${T.w.rim}" stroke-width="0.6"></circle><circle cx="35" cy="21" r="4.5" fill="${T.b.base}" stroke="${T.b.rim}" stroke-width="0.6"></circle></svg>`;
}

class App {
  constructor() {
    const s = store.get('ayar', {});
    this.settings = { name: s.name || '', to: s.to || 5, theme: THEMES[s.theme] ? s.theme : 'ceviz', sound: s.sound !== false, voice: s.voice !== false };
    this.sound = new Sound();
    this.sound.enabled = this.settings.sound;
    this.sound.voice = this.settings.voice;
    this.me = { id: clientId(), name: this.settings.name };
    this.G = null;
    this.room = null;
    this.mode = null;
    this.myColor = null;
    this.presence = {};
    this.sel = null;
    this.dests = null;
    this.queue = Promise.resolve();
    this.openShown = { w: 0, b: 0 };
    this.diceAnimating = false;
    this.holdResult = false;
    this.oppOnline = null;
    this.stateWaiters = [];
  }

  save() { store.set('ayar', this.settings); }

  // ============================================================ başlangıç
  init() {
    document.querySelectorAll('.ic[data-icon]').forEach((e) => { e.innerHTML = icon[e.dataset.icon](20); });
    $('#logo').innerHTML = logoDice;
    document.querySelectorAll('.logo-slot').forEach((e) => { e.innerHTML = logoDice; });
    const bg = tableBG(1600, 1000, 5, { plank: 150, lightX: 800, lightY: 430 });
    document.body.style.backgroundImage = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(bg)}")`;

    // giriş ekranı
    const name = $('#name');
    name.value = this.settings.name;
    name.addEventListener('change', () => { this.settings.name = name.value.trim(); this.save(); });
    document.querySelectorAll('#segTo button').forEach((b) => b.addEventListener('click', () => { this.settings.to = +b.dataset.to; this.save(); this.paintLobby(); }));
    this.buildSwatches($('#segTheme'), (k) => { this.settings.theme = k; this.save(); this.paintLobby(); });
    $('#btnCreate').addEventListener('click', () => this.createRoom());
    $('#btnLocal').addEventListener('click', () => this.startLocal());
    if (!onlineAvailable()) {
      const n = $('#fbNotice');
      n.hidden = false;
      n.innerHTML = 'Online oyun için Firebase ayarı henüz yapılmamış. Adımlar <a href="https://github.com/Sadrettin86/tavla#kurulum" target="_blank" rel="noopener">kurulum notunda</a>. Şimdilik “Aynı telefonda” oynayabilirsin.';
      $('#btnCreate').disabled = true;
    }
    this.paintLobby();
    if (FS.IOS && !FS.standalone() && !store.get('ipucu')) {
      $('#installTipText').textContent = FS.installSteps();
      $('#installTip').hidden = false;
    }
    $('#btnTipClose').addEventListener('click', () => { $('#installTip').hidden = true; store.set('ipucu', 1); });
    // açık oyunlar listesi: katıl / izle / devam et
    $('#gameList').addEventListener('click', (e) => {
      if (e.target.closest('button[data-cancel]')) { this.cancelWaiting(); return; }
      const del = e.target.closest('button[data-del]');
      if (del) { this.deleteGame(del.dataset.del, del.dataset.who); return; }
      const b = e.target.closest('button[data-room]');
      if (b) this.joinFromList(b.dataset.room);
    });

    // katıl
    $('#btnJoin').addEventListener('click', () => this.joinRoom(this.joinId));
    $('#joinName').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.joinRoom(this.joinId); });
    $('#btnJoinBack').addEventListener('click', () => this.leave());

    // bekleme

    // oyun
    this.stage = $('#stage');
    this.board = new BoardView($('#boardWrap'), { onTap: (t) => this.onTap(t) });
    this.board.setTheme(this.settings.theme);
    this.dice = new DiceView($('#diceLayer'), this.board);
    new ResizeObserver(() => { if (!this.diceAnimating) this.renderDice(); }).observe($('#boardWrap'));
    $('#btnMain').addEventListener('click', () => this.onMain());
    $('#btnUndo').addEventListener('click', () => this.onUndo());
    $('#btnSound').addEventListener('click', () => this.toggleSound());
    $('#btnLaf').addEventListener('click', () => { $('#lafPanel').hidden = !$('#lafPanel').hidden; });
    $('#btnLafClose').addEventListener('click', () => { $('#lafPanel').hidden = true; });
    $('#lafChips').innerHTML = PHRASES.map((p, i) => `<button type="button" data-i="${i}">${esc(p)}</button>`).join('');
    $('#lafChips').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) this.sendChat('phrase', PHRASES[+b.dataset.i]); });
    $('#lafReacts').innerHTML = REACTIONS.map((r) => `<button type="button" data-k="${r.key}" aria-label="${r.label}">${icon[r.key](24)}</button>`).join('');
    $('#lafReacts').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) this.sendChat('react', b.dataset.k); });

    // menü
    $('#btnMenu').addEventListener('click', () => this.openMenu());
    $('#btnMenuClose').addEventListener('click', () => { $('#menu').hidden = true; });
    $('#menu').addEventListener('click', (e) => { if (e.target.id === 'menu') $('#menu').hidden = true; });
    $('#mSound').addEventListener('click', () => this.toggleSound());
    $('#mVoice').addEventListener('click', () => {
      this.settings.voice = !this.settings.voice;
      this.sound.voice = this.settings.voice;
      this.save();
      this.paintMenu();
      if (this.settings.voice) this.sound.say('Şeşbeş');
    });
    $('#mFull').addEventListener('click', () => this.toggleFullscreen());
    this.buildSwatches($('#mTheme'), (k) => this.changeTheme(k));
    $('#mResign').addEventListener('click', () => this.resign());
    $('#mExit').addEventListener('click', async () => {
      $('#menu').hidden = true;
      if (this.G && (this.G.phase === 'move' || this.G.phase === 'roll') && !(await this.confirm('Oyundan çıkmak istiyor musun?'))) return;
      this.leave();
    });

    // sonuç
    $('#btnNext').addEventListener('click', () => this.onNext());
    $('#btnHome').addEventListener('click', () => this.leave());

    // ses kilidini ilk dokunuşta aç
    // iPhone'da ses yalnızca gerçek dokunuşla açılır (pointerdown sayılmaz)
    for (const ev of ['touchend', 'click', 'keydown']) document.addEventListener(ev, () => this.sound.unlock(), { capture: true, passive: true });
    // telefonda oyun ekranında tam ekrana geç (Android vb.; iPhone'da ana ekran uygulaması gerekir)
    this.fsWanted = FS.supported() && FS.touch();
    document.addEventListener('click', () => this.maybeFullscreen(), { capture: true, passive: true });
    FS.onChange(() => {
      // kullanıcı kendisi çıktıysa bir daha zorlama (arka plana geçince çıkılması sayılmaz)
      if (!FS.active() && document.visibilityState === 'visible' && !this.fsLeaving) this.fsWanted = false;
      this.fsLeaving = false;
      if (!$('#menu').hidden) this.paintMenu();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && (document.body.dataset.screen === 'game' || this.isWaiting())) this.keepAwake();
      if (document.visibilityState === 'visible') this.checkUpdate();
      this.updateTitle();
    });
    window.addEventListener('hashchange', () => this.route());
    this.route();
    setTimeout(() => this.checkUpdate(), 3000);
  }

  // Yeni sürüm yayımlandıysa sayfayı yenile. Ana ekran uygulaması kapanmadan arka planda
  // beklediği için eski sürüm açık kalabiliyor; uygulamaya dönünce bu kontrol çalışır.
  async checkUpdate() {
    const mine = document.querySelector('meta[name="tavla-version"]');
    if (testMode() || !mine || this.mode === 'local' || this.checkingUpdate) return;
    this.checkingUpdate = true;
    try {
      const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
      const v = r.ok ? (await r.json()).v : null;
      if (!v || v === mine.content) return;
      // aynı sürüm için en fazla 11 dakikada bir dene (önbellek eski sayfayı verirse döngüye girmesin)
      let last = {};
      try { last = JSON.parse(sessionStorage.getItem('tavla:yenileme') || '{}'); } catch (e) { /* yok say */ }
      if (last.v === v && Date.now() - last.t < 11 * 60e3) return;
      sessionStorage.setItem('tavla:yenileme', JSON.stringify({ v, t: Date.now() }));
      location.reload();
    } catch (e) { /* çevrimdışı: sonra yine bakılır */ } finally { this.checkingUpdate = false; }
  }

  route() {
    const id = decodeURIComponent(location.hash.slice(1)).toUpperCase();
    if (validRoomId(id)) {
      if (this.room && this.roomId === id) return;
      this.showJoin(id);
      // bu cihaz bu oyundaydı (ör. sayfa yenilendi ya da yeni sürüm geldi): sormadan geri dön
      const son = lastRoom.get();
      if (son && son.id === id && Date.now() - son.t < 24 * 3600e3 && this.settings.name) this.joinRoom(id, this.settings.name);
    } else if (!this.room) {
      this.show('lobby');
    }
  }

  show(name) {
    document.body.dataset.screen = name;
    if (name !== 'game') { $('#lafPanel').hidden = true; $('#menu').hidden = true; }
    if (name === 'lobby') this.startLobby(); else this.stopLobby();
  }

  // ============================================================ açık oyunlar listesi
  startLobby() {
    if (!onlineAvailable()) { $('#games').hidden = true; return; }
    $('#games').hidden = false;
    if (this.lobbyStop) return;
    if (!this.lastLobby) this.paintGames(null);
    let stop = null, alive = true;
    this.lobbyStop = () => { alive = false; if (stop) stop(); clearInterval(this.lobbyTick); };
    watchLobby((L) => this.paintGames(L), () => this.paintGames('err'))
      .then((f) => { if (alive) stop = f; else f(); })
      .catch(() => this.paintGames('err'));
    // "3 dk önce" yazıları ve bağlantısı kopanlar için arada bir yeniden çiz
    this.lobbyTick = setInterval(() => { if (this.lastLobby) this.paintGames(this.lastLobby); }, 20000);
  }

  stopLobby() {
    if (this.lobbyStop) { this.lobbyStop(); this.lobbyStop = null; }
  }

  paintGames(L) {
    const list = $('#gameList'), empty = $('#gamesEmpty');
    if (L === null || L === 'err') {
      list.innerHTML = '';
      empty.hidden = false;
      empty.textContent = L === null ? 'Oyunlar yükleniyor…' : 'Oyun listesi şu an açılamadı.';
      return;
    }
    this.lastLobby = L;
    const now = Date.now(), me = this.me.id;
    let waiting = this.isWaiting();
    if (waiting && this.roomId) {
      if (L[this.roomId]) this.waitSeen = this.roomId;
      else if (this.waitSeen === this.roomId) {
        // listede görünmüştü, şimdi yok: biri sildi
        this.waitSeen = null;
        this.leave();
        this.globalToast('Oyunun listeden silindi', 3200);
        return;
      }
    }
    const rows = Object.entries(L)
      .map(([id, e]) => ({ ...e, id, n: onlineCount(e), mine: !!e && (e.wi === me || e.bi === me) }))
      .filter((e) => validRoomId(e.id) && (e.st === 'open' || e.st === 'play') && (e.n > 0 || e.mine) && now - (e.t || 0) < 12 * 3600e3)
      .filter((e) => !(waiting && e.id === this.roomId));
    const byNew = (a, b) => (b.t || 0) - (a.t || 0);
    const open = rows.filter((e) => e.st === 'open').sort(byNew).slice(0, 8);
    const play = rows.filter((e) => e.st === 'play').sort(byNew).slice(0, 6);
    const th = this.settings.theme;
    const ago = (t) => { const m = Math.floor(Math.max(0, now - (t || now)) / 60000); return m < 1 ? 'az önce' : m < 60 ? `${m} dk önce` : `${Math.floor(m / 60)} sa önce`; };
    const btn = (e, label, cls, ic = '') => `<button type="button" class="btn small ${cls}" data-room="${e.id}">${ic}${label}</button>`;
    const item = (e) => {
      const isOpen = e.st === 'open';
      const who = isOpen ? esc(e.host || e.w || 'Oyuncu') : `${esc(e.w || '?')} <i>–</i> ${esc(e.b || '?')}`;
      const meta = `${e.to || 5} sayılık maç · ${isOpen ? ago(e.t) : 'oynanıyor'}`;
      const av = isOpen ? checkerIcon(th, 'w', 30, 'gl' + e.id) : `<span class="gi-pair">${checkerIcon(th, 'w', 24, 'glw' + e.id)}${checkerIcon(th, 'b', 24, 'glb' + e.id)}</span>`;
      const action = e.mine ? btn(e, 'Devam et', 'primary') : isOpen ? btn(e, 'Katıl', 'primary') : btn(e, 'İzle', '', icon.eye(16));
      const del = isOpen ? `<button type="button" class="gi-del" data-del="${e.id}" data-who="${esc(e.host || e.w || 'Oyuncu')}" aria-label="Oyunu sil">${icon.trash(18)}</button>` : '';
      return `<li class="game-item${isOpen ? ' open' : ''}${e.mine ? ' mine' : ''}"><span class="gi-av">${av}</span><span class="gi-main"><b>${who}</b><span>${meta}</span></span>${action}${del}</li>`;
    };
    let html = '';
    if (waiting) {
      const G = this.G;
      html += `<li class="game-item mine waiting"><span class="gi-av">${checkerIcon(th, this.myColor, 30, 'glme')}</span><span class="gi-main"><b>Senin oyunun</b><span>${G.match.to} sayı · rakip bekleniyor<span class="dots"><i></i><i></i><i></i></span></span></span><button type="button" class="btn small" data-cancel="1">Vazgeç</button></li>`;
    }
    if (open.length) html += open.map(item).join('');
    if (play.length) html += `<li class="gl-head">Süren oyunlar</li>` + play.map(item).join('');
    list.innerHTML = html;
    empty.hidden = !!html;
    if (!html) empty.textContent = 'Şu an açık oyun yok. Aşağıdan bir oyun kur; siteye giren biri listeden katılınca başlarsınız.';
  }

  async joinFromList(id) {
    if (this.joining || !validRoomId(id)) return;
    const name = this.readName('#name');
    if (!name) return;
    if (this.room) await this.dropWaiting();
    await this.joinRoom(id, name, (msg) => this.globalToast(msg, 3500));
  }

  // listedeki kaydı oyunun durumuyla eşitle (yalnızca oyuncular yazar)
  syncLobby() {
    const G = this.G;
    if (!G || !this.room || this.mode !== 'online' || !this.myColor) return;
    const P = G.players;
    const st = !(P.w && P.b) ? 'open' : G.phase === 'matchover' ? 'over' : 'play';
    const host = (P.w || P.b).name;
    const info = { host, to: G.match.to, st, w: P.w ? P.w.name : '', b: P.b ? P.b.name : '', wi: P.w ? P.w.id : '', bi: P.b ? P.b.id : '' };
    const key = JSON.stringify(info);
    if (key === this.lobbyKey) return;
    this.lobbyKey = key;
    this.room.publish(info);
  }

  buildSwatches(box, onPick) {
    box.innerHTML = THEME_KEYS.map((k) => `<button type="button" data-theme="${k}" aria-pressed="false">${themeSwatch(k)}${THEMES[k].name}</button>`).join('');
    box.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) onPick(b.dataset.theme); });
  }

  paintLobby() {
    document.querySelectorAll('#segTo button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.to === this.settings.to)));
    document.querySelectorAll('#segTheme button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.theme === this.settings.theme)));
    const start = Rules.initialBoard();
    const pos = { pts: {}, bar: {}, off: {} };
    for (let a = 1; a <= 24; a++) if (start.p[a]) pos.pts[a] = [start.p[a] > 0 ? 'w' : 'b', Math.abs(start.p[a])];
    if (this.heroTheme !== this.settings.theme) {
      this.heroTheme = this.settings.theme;
      const { svg } = renderBoard({ W: 520, H: 362, theme: this.settings.theme, pos, id: 'hero', seed: 41, pad: [14, 12] });
      $('#heroBoard').innerHTML = `<img alt="" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}">`;
    }
  }

  readName(sel) {
    const v = $(sel).value.trim().slice(0, 16);
    if (!v) { $(sel).focus(); this.globalToast('Önce adını yaz'); return null; }
    this.settings.name = v; this.me.name = v; this.save();
    return v;
  }

  globalToast(text, ms = 2200) {
    const t = $('#globalToast');
    t.textContent = text; t.hidden = false;
    clearTimeout(this._gt);
    this._gt = setTimeout(() => { t.hidden = true; }, ms);
  }

  // ============================================================ oda kurma / katılma
  handlers() {
    return {
      onState: (G) => this.onState(G),
      onPresence: (p) => this.onPresence(p),
      onChat: (m) => this.onChat(m),
      onConn: (on) => this.onConn(on),
      onError: () => this.globalToast('Odaya erişilemedi. Firebase kurallarını kontrol et.', 4000),
    };
  }

  async createRoom() {
    this.sound.unlock();
    const name = this.readName('#name');
    if (!name) return;
    if (this.isWaiting()) return;
    this.creating = true;
    this.paintCreate();
    try {
      const id = newRoomId();
      this.mode = 'online';
      this.roomId = id;
      this.room = await connectRoom(id, { id: this.me.id, name, color: 'w' }, this.handlers());
      const fresh = Rules.sit(Rules.newGameState({ to: this.settings.to, rules: 'tr', theme: this.settings.theme }), 'w', { id: this.me.id, name });
      const ok = await this.room.transact((G) => (G ? undefined : fresh));
      if (!ok) throw new Error('oda kurulamadı');
      history.replaceState(null, '', location.pathname + location.search + '#' + id);
      await this.waitState(5000);
      this.syncLobby();
      this.room.lobbyOnline(true);
      lastRoom.set({ id, t: Date.now() });
      this.waitInLobby();
      $('#games').scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.globalToast('Oyunun listeye eklendi. Biri katılınca oyun açılır.', 3200);
    } catch (e) {
      console.error(e);
      this.globalToast('Oyun kurulamadı. Bağlantını ve Firebase ayarını kontrol et.', 4000);
      this.leave();
    } finally { this.creating = false; this.paintCreate(); }
  }

  showJoin(id) {
    this.joinId = id;
    $('#joinCode').textContent = id;
    $('#joinName').value = this.settings.name;
    const err = $('#joinError');
    if (!onlineAvailable()) { err.hidden = false; err.textContent = 'Bu sitenin online ayarı henüz yapılmamış.'; $('#btnJoin').disabled = true; }
    else { err.hidden = true; $('#btnJoin').disabled = false; }
    this.show('join');
  }

  async joinRoom(id, name = null, report = null) {
    this.sound.unlock();
    if (!validRoomId(id) || this.joining) return;
    if (!name) name = this.readName('#joinName');
    if (!name) return;
    const say = report || ((msg) => { const err = $('#joinError'); err.hidden = false; err.textContent = msg; });
    const btn = $('#btnJoin');
    btn.disabled = true;
    this.joining = true;
    try {
      this.mode = 'online';
      this.roomId = id;
      this.room = await connectRoom(id, { id: this.me.id, name }, this.handlers());
      await this.room.transact((G) => {
        if (!G) return null;
        const P = G.players;
        // aynı tarayıcıdan dönen oyuncu yerini kimliğinden tanır
        if ((P.w && P.w.id === this.me.id) || (P.b && P.b.id === this.me.id)) return undefined;
        if (!P.b) return Rules.sit(G, 'b', { id: this.me.id, name });
        if (!P.w) return Rules.sit(G, 'w', { id: this.me.id, name });
        // iki yer de dolu: sonradan gelen izleyici olur (adı aynı olsa bile kimsenin yerine oturamaz)
        return undefined;
      });
      const G = await this.waitState(6000);
      if (!G) {
        say(report ? 'Bu oyun artık yok.' : 'Bu oda bulunamadı. Linki kontrol et.');
        this.room.close(); this.room = null; this.mode = null; this.roomId = null;
        return;
      }
      this.updateSeat();
      this.room.setPresence({ name, color: this.myColor || '' });
      history.replaceState(null, '', location.pathname + location.search + '#' + id);
      if (this.myColor) { this.syncLobby(); this.room.lobbyOnline(true); }
      lastRoom.set({ id, t: Date.now() });
      if (G.players.w && G.players.b) {
        this.enterGame();
        if (this.spectator()) FX.toast(this.stage, 'Oyun başlamış, izleyici olarak katıldın', 2800);
      } else this.waitInLobby();
    } catch (e) {
      console.error(e);
      say('Bağlanılamadı. İnternetini kontrol edip tekrar dene.');
      if (this.room) { this.room.close(); this.room = null; }
      this.mode = null; this.roomId = null;
    } finally { btn.disabled = false; this.joining = false; }
  }

  waitState(ms) {
    if (this.G) return Promise.resolve(this.G);
    return new Promise((res) => {
      const t = setTimeout(() => res(this.G), ms);
      this.stateWaiters.push(() => { clearTimeout(t); res(this.G); });
    });
  }

  async startLocal() {
    this.sound.unlock();
    if (this.room) await this.dropWaiting();
    const n = $('#name').value.trim().slice(0, 16);
    if (n) { this.settings.name = n; this.save(); }
    this.mode = 'local';
    this.roomId = null;
    this.myColor = null;
    this.G = null;
    this.room = new OfflineRoom(this.handlers());
    let G = Rules.newGameState({ to: this.settings.to, rules: 'tr', theme: this.settings.theme });
    G = Rules.sit(G, 'w', { id: 'w', name: n || 'Beyaz' });
    G = Rules.sit(G, 'b', { id: 'b', name: 'Misafir' });
    this.room.transact(() => G);
    this.enterGame();
  }

  leave() {
    if (this.room) { try { this.room.close(); } catch (e) { /* yok say */ } }
    this.lobbyKey = null;
    lastRoom.set(null);
    this.room = null; this.G = null; this.mode = null; this.myColor = null; this.roomId = null;
    this.presence = {}; this.sel = null; this.dests = null; this.oppOnline = null;
    this.openShown = { w: 0, b: 0 };
    this.queue = Promise.resolve();
    if (this.dice) this.dice.clear();
    if (this.board) this.board.clearMarks();
    $('#result').hidden = true;
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    if (this.wl) { try { this.wl.release(); } catch (e) { /* yok say */ } this.wl = null; }
    this.show('lobby');
    this.paintLobby();
    if (this.lastLobby) this.paintGames(this.lastLobby);
    this.paintCreate();
    this.updateTitle();
  }

  // Kurduğun oyun giriş sayfasındaki listede bekler; biri katılınca oyun kendiliğinden açılır
  isWaiting() {
    const G = this.G;
    return this.mode === 'online' && !!this.room && !!this.myColor && !!G && !(G.players.w && G.players.b);
  }

  waitInLobby() {
    this.show('lobby');
    this.paintGames(this.lastLobby || {});
    this.paintCreate();
    this.keepAwake();
  }

  async deleteGame(id, who) {
    if (!(await this.confirm(`${who} oyununu listeden silmek istiyor musun?`))) return;
    try { await removeLobbyEntry(id); this.globalToast('Oyun silindi'); }
    catch (e) { this.globalToast('Silinemedi, tekrar dene'); }
  }

  async cancelWaiting() {
    if (!this.isWaiting()) return;
    try { await this.room.unpublish(); } catch (e) { /* yok say */ }
    this.leave();
    this.globalToast('Oyunun listeden kalktı');
  }

  // bekleyen oyunu bırak (başka oyuna katılmadan ya da aynı telefonda oynamadan önce)
  async dropWaiting() {
    if (!this.room) return;
    if (this.isWaiting()) { try { await this.room.unpublish(); } catch (e) { /* yok say */ } }
    this.leave();
  }

  paintCreate() {
    const btn = $('#btnCreate');
    const waiting = this.isWaiting();
    btn.disabled = waiting || !onlineAvailable() || this.creating;
    btn.querySelector('.lbl').textContent = waiting ? 'Oyunun listede' : 'Oyun kur';
  }

  enterGame() {
    this.show('game');
    this.keepAwake();
    this.maybeFullscreen();
    this.snap();
    // yeni oyun: pullar tahtaya dağıtılır
    const G = this.G;
    if (G && G.phase === 'opening' && !G.opening.w && !G.opening.b) this.enqueue(() => this.board.dealIn(() => this.sound.place()));
  }

  maybeFullscreen() {
    if (this.fsWanted && document.body.dataset.screen === 'game' && !FS.active()) FS.enter();
  }

  async toggleFullscreen() {
    if (FS.supported()) {
      if (FS.active()) { this.fsWanted = false; this.fsLeaving = true; await FS.exit(); }
      else { this.fsWanted = true; await FS.enter(); }
      this.paintMenu();
      return;
    }
    const tip = $('#mFullTip');
    tip.textContent = FS.installSteps();
    tip.hidden = !tip.hidden;
  }

  async keepAwake() {
    try {
      if ('wakeLock' in navigator && document.visibilityState === 'visible' && !this.wl) {
        this.wl = await navigator.wakeLock.request('screen');
        this.wl.addEventListener('release', () => { this.wl = null; });
      }
    } catch (e) { /* desteklenmiyor */ }
  }

  // ============================================================ durum
  updateSeat() {
    const G = this.G;
    if (!G) return;
    if (this.mode === 'local') { this.myColor = null; return; }
    const P = G.players;
    this.myColor = P.w && P.w.id === this.me.id ? 'w' : P.b && P.b.id === this.me.id ? 'b' : null;
  }

  viewer() { return this.mode === 'local' ? 'w' : this.myColor || 'w'; }
  isMyTurn() {
    if (!this.G) return false;
    if (this.mode === 'local') return true;
    return !!this.myColor && this.G.turn === this.myColor;
  }
  spectator() { return this.mode === 'online' && !this.myColor; }
  nameOf(c) { const p = this.G && this.G.players[c]; return p ? p.name : c === 'w' ? 'Beyaz' : 'Siyah'; }

  onState(G) {
    const waiters = this.stateWaiters; this.stateWaiters = [];
    if (!G) { waiters.forEach((f) => f()); return; }
    const prev = this.G;
    this.G = G;
    this.updateSeat();
    this.syncLobby();
    waiters.forEach((f) => f());
    const screen = document.body.dataset.screen;
    if (screen === 'lobby' && this.mode === 'online') {
      if (this.myColor && G.players.w && G.players.b && prev && !(prev.players.w && prev.players.b)) {
        this.sound.join();
        this.enterGame();
        FX.toast(this.stage, `${this.nameOf(other(this.myColor))} geldi, iyi oyunlar`);
        return;
      }
      this.paintGames(this.lastLobby || {});
      this.paintCreate();
      return;
    }
    if (screen !== 'game') return;
    const seq = G.seq;
    if (!prev || G.seq < prev.seq) { this.enqueue(() => this.snap(seq)); return; }
    if (G.seq === prev.seq) {
      if (JSON.stringify(G) !== JSON.stringify(prev)) this.enqueue(() => this.snap(seq));
      return;
    }
    const acts = (G.log || []).filter((a) => a.seq > prev.seq);
    if (!acts.length || acts[0].seq !== prev.seq + 1) { this.enqueue(() => this.snap(seq)); return; }
    let board = prev.board;
    for (const a of acts) {
      const before = board;
      if (a.t === 'move') board = Rules.applyMove(board, a.by, a.m);
      else if (a.t === 'undo') board = Rules.unapplyMove(board, a.by, a.m);
      else if (a.t === 'newgame' || a.t === 'rematch') board = Rules.initialBoard();
      const after = board;
      this.enqueue(() => this.playAction(a, before, after));
    }
    this.enqueue(() => this.snap(seq));
  }

  enqueue(fn) {
    this.queue = this.queue.then(fn).catch((e) => console.error(e));
  }

  snap(seq = null) {
    const G = this.G;
    if (!G || document.body.dataset.screen !== 'game') return;
    if (seq != null && seq !== G.seq) return; // daha yeni bir durum sırada
    this.board.setTheme(G.theme);
    this.dice.setSkin(G.theme === 'gece' ? 'gece' : 'kemik');
    this.board.setViewer(this.viewer());
    this.board.render(G);
    this.renderDice();
    this.renderRails();
    this.renderButtons();
    this.refreshSelection();
    const showLast = G.last && (G.phase === 'roll' || (G.phase === 'move' && !G.moves.length)) && G.last.by !== G.turn;
    this.board.markLast(showLast ? G.last : null);
    this.renderResult();
    this.updateTitle();
  }

  renderDice() {
    const G = this.G;
    if (!G || !this.dice || this.diceAnimating) return;
    const v = this.viewer();
    if ((G.phase === 'opening' || G.phase === 'roll') && (G.opening.w || G.opening.b)) {
      this.dice.showOpening(G.opening[v], G.opening[other(v)], [this.nameOf(v), this.nameOf(other(v))]);
      return;
    }
    if ((G.phase === 'move' || G.phase === 'gameover' || G.phase === 'matchover') && G.dice) {
      const side = G.turn === v ? 'right' : 'left';
      const dbl = G.dice[0] === G.dice[1];
      let used;
      if (G.phase !== 'move') used = [true, true];
      else if (dbl) used = [G.rem.length <= 2, G.rem.length === 0];
      else {
        const r = G.rem.slice();
        used = G.dice.map((d) => { const i = r.indexOf(d); if (i >= 0) { r.splice(i, 1); return false; } return true; });
      }
      this.dice.show(G.dice, { side, used, left: dbl && G.phase === 'move' ? G.rem.length : null });
      return;
    }
    this.dice.clear();
  }

  playerOnline(c) {
    if (this.mode !== 'online') return true;
    const p = this.G && this.G.players[c];
    return !!(p && this.presence[p.id]);
  }

  // Oyuncu kartları: yalnızca ad (ve rengini gösteren küçük pul). Sıradaki oyuncunun kartı hareketli ışıkla belirginleşir.
  renderRails() {
    const G = this.G;
    const v = this.viewer();
    const seated = !!(G.players.w && G.players.b);
    const live = G.phase === 'move' || G.phase === 'roll';
    const paint = (el, c) => {
      const p = G.players[c];
      // sırası gelen; açılışta zarını henüz atmamış olanlar
      const active = seated && ((live && G.turn === c) || (G.phase === 'opening' && !G.opening[c]));
      const away = this.mode === 'online' && !!p && c !== this.myColor && !this.playerOnline(c);
      const html = `<div class="pc-top">${checkerIcon(G.theme, c, 28, 'av' + c)}<div class="pc-name">${esc(p ? p.name : 'Bekleniyor')}</div></div>`;
      const box = el.querySelector('.pc-in');
      if (box._h !== html) { box.innerHTML = html; box._h = html; }
      const was = el.classList.contains('turn');
      el.classList.toggle('turn', active);
      el.classList.toggle('away', away);
      el.title = away ? 'Bağlı değil' : '';
      if (active) el.setAttribute('aria-current', 'true'); else el.removeAttribute('aria-current');
      if (active && !was) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
    };
    paint($('#cardTop'), other(v));
    paint($('#cardBottom'), v);
  }

  renderButtons() {
    const G = this.G;
    const main = $('#btnMain');
    const my = this.isMyTurn();
    let label = 'Zar at', ic = 'dice', enabled = false, ready = false;
    const seated = G.players.w && G.players.b;
    if (this.spectator()) { label = 'İzliyorsun'; ic = 'eye'; }
    else if (G.phase === 'opening') {
      if (!seated) label = 'Bekleniyor';
      else if (this.mode === 'local') { enabled = !G.opening.w && !G.opening.b; ready = enabled; }
      else if (G.opening[this.myColor]) label = 'Rakip atacak';
      else { enabled = true; ready = true; }
    } else if (G.phase === 'roll') {
      if (my) { enabled = true; ready = true; } else label = 'Sıra rakipte';
    } else if (G.phase === 'move') {
      if (my) { label = 'Tamam'; ic = 'check'; enabled = Rules.canEndTurn(G); ready = enabled; }
      else label = 'Sıra rakipte';
    } else { label = 'El bitti'; ic = 'crown'; }
    // dar sütunda yazı sığsın: simge yalnızca basılabilir durumda
    main.innerHTML = `${enabled ? icon[ic](18) : ''}<span class="lbl">${label}</span>`;
    main.disabled = !enabled;
    main.classList.toggle('ready', ready);
    $('#btnUndo').disabled = !(my && G.phase === 'move' && G.moves.length > 0);
    $('#btnLaf').hidden = this.mode !== 'online' || this.spectator();
    $('#btnSound').innerHTML = (this.settings.sound ? icon.sound : icon.mute)(20);
    $('#btnSound').setAttribute('aria-label', this.settings.sound ? 'Sesi kapat' : 'Sesi aç');
  }

  refreshSelection() {
    const G = this.G;
    if (!G || G.phase !== 'move' || !this.isMyTurn() || this.spectator()) { this.sel = null; this.dests = null; this.board.clearMarks(); return; }
    const legal = Rules.currentLegal(G);
    if (!legal.length) { this.sel = null; this.dests = null; this.board.clearMarks(); return; }
    const sources = [...new Set(legal.map((m) => m.from))];
    if (this.sel != null && !sources.includes(this.sel)) this.sel = null;
    if (this.sel == null && sources.length === 1) this.sel = sources[0];
    if (this.sel != null) {
      this.dests = Rules.destinations(G.board, G.turn, G.rem, Rules.RULESETS[G.rules], G.locked, this.sel);
      this.board.mark({ selected: this.sel, dests: this.dests, color: G.turn });
    } else {
      this.dests = null;
      this.board.mark({ movable: sources, color: G.turn });
    }
  }

  updateTitle() {
    const mine = this.G && this.mode === 'online' && this.isMyTurn() && (this.G.phase === 'roll' || this.G.phase === 'move');
    document.title = mine && document.visibilityState === 'hidden' ? '● Sıra sende · Tavla' : 'Tavla';
  }

  // ============================================================ hamleler
  act(fn) {
    if (!this.room) return Promise.resolve(false);
    return this.room.transact((G) => (G ? fn(G) || undefined : null)).catch((e) => {
      console.error(e);
      this.globalToast('Hamle gönderilemedi, bağlantıyı kontrol et');
      return false;
    });
  }

  canRoll() {
    const G = this.G;
    if (!G || this.spectator()) return false;
    if (G.phase === 'opening') {
      if (!(G.players.w && G.players.b)) return false;
      if (this.mode === 'local') return !G.opening.w && !G.opening.b;
      return !G.opening[this.myColor];
    }
    return G.phase === 'roll' && this.isMyTurn();
  }

  async doRoll() {
    if (this.busyRoll || !this.canRoll()) return;
    this.busyRoll = true;
    try {
      const G = this.G;
      if (G.phase === 'opening') {
        if (this.mode === 'local') {
          await this.act((S) => Rules.rollOpening(S, 'w', Rules.rollDie()));
          await this.act((S) => Rules.rollOpening(S, 'b', Rules.rollDie()));
        } else {
          const c = this.myColor;
          await this.act((S) => Rules.rollOpening(S, c, Rules.rollDie()));
        }
      } else {
        const c = G.turn, a = Rules.rollDie(), b = Rules.rollDie();
        await this.act((S) => Rules.roll(S, c, a, b));
      }
    } finally {
      setTimeout(() => { this.busyRoll = false; }, 350);
    }
  }

  onMain() {
    this.sound.unlock();
    const G = this.G;
    if (!G) return;
    if (G.phase === 'opening' || G.phase === 'roll') return this.doRoll();
    if (G.phase === 'move' && this.isMyTurn() && Rules.canEndTurn(G)) {
      const c = G.turn;
      this.sel = null;
      this.act((S) => Rules.endTurn(S, c));
    }
  }

  onUndo() {
    const G = this.G;
    if (!G || G.phase !== 'move' || !this.isMyTurn() || !G.moves.length) return;
    const c = G.turn;
    this.sel = null;
    this.act((S) => Rules.undo(S, c));
  }

  onTap(t) {
    this.sound.unlock();
    const G = this.G;
    if (!G || !this.room || this.spectator()) return;
    if (G.phase === 'opening' || G.phase === 'roll') { if (this.canRoll()) this.doRoll(); return; }
    if (G.phase !== 'move' || !this.isMyTurn()) return;
    const key = t === 'off' ? 'off' : t === 'bar' ? 'bar' : +t;
    if (this.sel != null && this.dests && key !== 'bar' && this.dests.has(key)) {
      this.doChain(this.dests.get(key));
      return;
    }
    const legal = Rules.currentLegal(G);
    if (legal.some((m) => m.from === key)) {
      this.sel = key;
      this.refreshSelection();
      return;
    }
    if (this.sel != null && legal.length && new Set(legal.map((m) => m.from)).size > 1) {
      this.sel = null;
      this.refreshSelection();
    } else if (legal.length) this.sound.error();
  }

  async doChain(chain) {
    const c = this.G.turn;
    this.sel = null;
    this.dests = null;
    this.board.clearMarks();
    for (const m of chain) {
      const ok = await this.act((S) => Rules.move(S, c, m));
      if (!ok) break;
    }
  }

  async onNext() {
    const G = this.G;
    if (!G) return;
    this.sound.unlock();
    if (G.phase === 'gameover') await this.act((S) => Rules.nextGame(S));
    else if (G.phase === 'matchover') await this.act((S) => Rules.rematch(S));
  }

  async resign() {
    $('#menu').hidden = true;
    const G = this.G;
    if (!G || !(G.phase === 'move' || G.phase === 'roll')) { this.globalToast('Şu an bırakılacak bir el yok'); return; }
    const c = this.mode === 'local' ? G.turn : this.myColor;
    if (!c) return;
    if (!(await this.confirm(this.mode === 'local' ? `${this.nameOf(c)} bu eli bırakıyor. Rakip 1 sayı alır. Emin misin?` : 'Bu eli bırakıyor musun? Rakibin 1 sayı alır.'))) return;
    this.act((S) => Rules.resign(S, c));
  }

  // ============================================================ animasyonlar
  async playAction(a, before, after) {
    const G = this.G;
    const stage = this.stage;
    switch (a.t) {
      case 'sit':
        if (this.mode === 'online' && G.players[a.by] && G.players[a.by].id !== this.me.id) {
          this.sound.join();
          FX.toast(stage, `${a.name} geldi`);
        }
        break;
      case 'open': {
        this.openShown[a.by] = a.die;
        this.sound.dice();
        const v = this.viewer();
        this.diceAnimating = true;
        try {
          await this.dice.showOpening(this.openShown[v], this.openShown[other(v)], [this.nameOf(v), this.nameOf(other(v))], { animateMine: a.by === v, animateTheirs: a.by !== v });
        } finally { this.diceAnimating = false; }
        break;
      }
      case 'openTie':
        await wait(450);
        FX.toast(stage, 'Eşit geldi, yeniden atın');
        this.openShown = { w: 0, b: 0 };
        await wait(700);
        break;
      case 'openWin': {
        await wait(350);
        const r = Rules.RULESETS[G.rules];
        const who = this.mode === 'online' && a.by === this.myColor ? 'Sen başlıyorsun' : `${this.nameOf(a.by)} başlıyor`;
        FX.toast(stage, r.openingReroll ? `${who}, zar yeniden atılacak` : who, 2200);
        this.openShown = { w: 0, b: 0 };
        if (this.mode === 'online' && a.by === this.myColor) this.sound.turn();
        await wait(600);
        break;
      }
      case 'roll': {
        this.sound.dice();
        const side = a.by === this.viewer() ? 'right' : 'left';
        this.diceAnimating = true;
        try { await this.dice.roll(a.dice, { side }); } finally { this.diceAnimating = false; }
        const nm = diceName(a.dice[0], a.dice[1]);
        if (a.dice[0] === a.dice[1]) {
          this.sound.doubles();
          FX.banner(stage, upperTR(nm) + '!', `${a.dice[0]} · ${a.dice[1]} — dört hamle`);
        } else this.namePill(nm, side);
        this.sound.say(nm);
        this.maybeAutoPass(a.by);
        break;
      }
      case 'move':
        await this.board.animateMove(a.m, a.by, { board: before }, {
          onLand: (off) => (off ? this.sound.bearOff() : this.sound.place()),
          onHit: (x, y) => {
            this.sound.hit();
            this.board.burst(x, y, THEMES[G.theme].danger);
            if (this.mode === 'online') FX.toast(stage, a.by === this.myColor ? 'Kırdın!' : 'Pulun kırıldı');
            else FX.toast(stage, `${this.nameOf(a.by)} kırdı!`);
          },
        });
        this.board.render({ ...G, board: after });
        break;
      case 'undo':
        this.board.clearMarks();
        await this.board.animateUndo(a.m, a.by, before, { onLand: () => this.sound.place() });
        this.board.render({ ...G, board: after });
        break;
      case 'end':
        if (a.pass) FX.toast(stage, `${this.nameOf(a.by)} oynayamadı`);
        if (this.mode === 'online' && this.myColor && this.myColor !== a.by) {
          this.sound.turn();
          if (!a.pass) FX.toast(stage, 'Sıra sende');
        }
        if (this.mode === 'local') this.sound.turn();
        break;
      case 'gameover':
        await this.celebrate(a);
        break;
      case 'newgame':
      case 'rematch':
        this.openShown = { w: 0, b: 0 };
        this.renderResult();
        this.board.clearMarks();
        this.board.markLast(null);
        this.dice.clear();
        this.board.render({ ...G, board: after });
        this.renderRails();
        this.renderButtons();
        FX.toast(stage, a.t === 'rematch' ? 'Rövanş başlıyor' : `${a.game}. el başlıyor`);
        this.sound.join();
        await this.board.dealIn(() => this.sound.place());
        break;
      default:
        break;
    }
  }

  namePill(text, side) {
    const c = side === 'right' ? this.board.right : this.board.left;
    const p = this.board.toPx(c.x, c.y - 30);
    const d = document.createElement('div');
    d.className = 'fx-name';
    d.textContent = text;
    d.style.left = p.x + 'px';
    d.style.top = p.y + 'px';
    $('#boardWrap').appendChild(d);
    setTimeout(() => d.remove(), 1800);
  }

  maybeAutoPass(c) {
    setTimeout(() => {
      const G = this.G;
      if (!G || G.phase !== 'move' || G.turn !== c || G.moves.length || !this.isMyTurn()) return;
      if (Rules.currentLegal(G).length) return;
      FX.toast(this.stage, 'Oynanacak hamle yok', 1600);
      setTimeout(() => {
        const S = this.G;
        if (S && S.phase === 'move' && S.turn === c && !S.moves.length && Rules.canEndTurn(S)) this.act((X) => Rules.endTurn(X, c));
      }, 1500);
    }, 250);
  }

  async celebrate(a) {
    this.holdResult = true;
    try {
      const winner = a.by;
      const meWon = this.mode !== 'online' || winner === this.myColor;
      const spectator = this.spectator();
      if (a.mars) this.sound.mars();
      await wait(a.mars ? 450 : 150);
      if (meWon || spectator) { this.sound.win(); FX.confetti(document.body); }
      else this.sound.lose();
      let word, tone = 'gold';
      if (this.mode === 'online' && !spectator) { word = meWon ? 'KAZANDIN!' : 'KAYBETTİN'; tone = meWon ? 'gold' : 'red'; }
      else word = 'KAZANDI!';
      const sub = (this.mode === 'online' && !spectator ? '' : this.nameOf(winner) + ' · ') + (a.resigned ? 'el bırakıldı' : a.mars ? 'Mars! +2 sayı' : '+1 sayı');
      FX.banner(this.stage, word, sub, { tone });
      await wait(1700);
    } finally { this.holdResult = false; }
  }

  renderResult() {
    const G = this.G;
    const box = $('#result');
    if (!G || !(G.phase === 'gameover' || G.phase === 'matchover') || this.holdResult) { box.hidden = true; return; }
    const r = G.result || {};
    const v = this.viewer();
    const winner = r.winner;
    const matchOver = G.phase === 'matchover';
    $('#resKicker').innerHTML = `${icon.crown(17)}${matchOver ? 'Maç bitti' : `${G.match.game}. el bitti`}`;
    let title;
    if (r.resigned) title = `${this.nameOf(r.resigned)} eli bıraktı`;
    else if (this.mode === 'online' && winner === this.myColor) title = matchOver ? 'Maçı aldın' : 'Eli aldın';
    else title = `${this.nameOf(winner)} ${matchOver ? 'maçı aldı' : 'kazandı'}`;
    $('#resTitle').textContent = title;
    const sc = G.match.score;
    $('#resScore').innerHTML = `<div class="who">${checkerIcon(G.theme, v, 28, 'rs1')}<span>${esc(this.nameOf(v))}</span></div><div class="nums"><span>${sc[v]}</span><i>–</i><span>${sc[other(v)]}</span></div><div class="who"><span>${esc(this.nameOf(other(v)))}</span>${checkerIcon(G.theme, other(v), 28, 'rs2')}</div>`;
    const st = G.stats;
    const cell = (k, x) => `<div><span>${k}</span><b>${x[v]} – ${x[other(v)]}</b></div>`;
    $('#resStats').innerHTML = cell('Çift zar', st.doubles) + cell('Kırılan pul', st.hits) + cell('Mars', st.mars);
    const next = $('#btnNext');
    next.textContent = matchOver ? 'Rövanş' : 'Sonraki el';
    next.hidden = this.spectator();
    const card = box.querySelector('.result-card');
    const old = card.querySelector('.fx-stamp');
    if (old) old.remove();
    if (r.mars && !r.resigned) FX.stamp(card);
    box.hidden = false;
  }

  // ============================================================ sohbet, bağlantı
  sendChat(kind, text) {
    $('#lafPanel').hidden = true;
    if (!this.room || this.mode !== 'online' || this.spectator()) return;
    const now = Date.now();
    if (this._lastChat && now - this._lastChat < 1200) return;
    this._lastChat = now;
    this.room.sendChat({ kind, text, color: this.myColor || '' });
  }

  onChat(m) {
    const G = this.G;
    if (!G || !m) return;
    const P = G.players;
    const c = P.w && P.w.id === m.from ? 'w' : P.b && P.b.id === m.from ? 'b' : null;
    if (!c || document.body.dataset.screen !== 'game') return;
    const anchor = c === this.viewer() ? $('#cardBottom') : $('#cardTop');
    if (m.kind === 'react' && icon[m.text] && REACTIONS.some((r) => r.key === m.text)) FX.floatIcon(anchor, icon[m.text](34));
    else if (m.kind === 'phrase') FX.bubble(anchor, String(m.text || '').slice(0, 80));
    this.sound.pop();
  }

  onPresence(p) {
    this.presence = p || {};
    if (!this.G) return;
    if (document.body.dataset.screen === 'game') this.renderRails();
    // yeni gelen izleyiciler (oyunculara kısa bir not)
    const seated = new Set(['w', 'b'].map((c) => this.G.players[c] && this.G.players[c].id).filter(Boolean));
    const watchers = Object.keys(this.presence).filter((id) => !seated.has(id) && id !== this.me.id);
    const full = !!(this.G.players.w && this.G.players.b);
    if (this.watchers && full && this.mode === 'online' && this.myColor && document.body.dataset.screen === 'game') {
      for (const id of watchers) if (!this.watchers.has(id)) FX.toast(this.stage, `${(this.presence[id] && this.presence[id].name) || 'Biri'} izlemeye geldi`, 2400);
    }
    this.watchers = new Set(watchers);
    if (this.mode === 'online' && this.myColor) {
      const opp = this.G.players[other(this.myColor)];
      if (opp) {
        const on = !!this.presence[opp.id];
        if (this.oppOnline === true && !on) FX.toast(this.stage, `${opp.name} bağlantıdan düştü`, 2500);
        if (this.oppOnline === false && on) FX.toast(this.stage, `${opp.name} geri geldi`, 2000);
        this.oppOnline = on;
      }
    }
  }

  onConn(on) {
    if (this.mode !== 'online') return;
    if (this._conn === true && !on) this.globalToast('Bağlantı koptu, yeniden bağlanıyor…', 3500);
    if (this._conn === false && on) this.globalToast('Bağlandı');
    this._conn = on;
  }

  // ============================================================ menü, ayarlar
  openMenu() {
    $('#mFullTip').hidden = true;
    this.paintMenu();
    $('#mResign').hidden = this.spectator();
    $('#menu').hidden = false;
  }

  paintMenu() {
    $('#mSoundVal').textContent = this.settings.sound ? 'Açık' : 'Kapalı';
    $('#mFull').hidden = FS.standalone() || (!FS.supported() && !FS.IOS);
    $('#mFullVal').textContent = FS.supported() ? (FS.active() ? 'Açık' : 'Kapalı') : 'Nasıl?';
    $('#mVoiceVal').textContent = this.settings.voice ? 'Açık' : 'Kapalı';
    const cur = this.G ? this.G.theme : this.settings.theme;
    document.querySelectorAll('#mTheme button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.theme === cur)));
  }

  toggleSound() {
    this.settings.sound = !this.settings.sound;
    this.sound.enabled = this.settings.sound;
    this.save();
    this.sound.unlock();
    if (this.settings.sound) setTimeout(() => this.sound.place(), 80);
    this.paintMenu();
    if (this.G) this.renderButtons();
  }

  changeTheme(k) {
    this.settings.theme = k;
    this.save();
    if (this.G && !this.spectator()) this.act((S) => (S.theme === k ? undefined : Rules.setTheme(S, k)));
    this.paintMenu();
  }

  confirm(text) {
    return new Promise((res) => {
      const box = $('#confirm');
      $('#confirmText').textContent = text;
      box.hidden = false;
      const done = (v) => { box.hidden = true; $('#confirmYes').onclick = null; $('#confirmNo').onclick = null; res(v); };
      $('#confirmYes').onclick = () => done(true);
      $('#confirmNo').onclick = () => done(false);
    });
  }
}

const app = new App();
app.init();
if (testMode()) window.tavla = app;
