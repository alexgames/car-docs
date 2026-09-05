const App = {};

// ──────────────────────────────────────────────
// Константы
// ──────────────────────────────────────────────
App.Const = {
  CANVAS_HEIGHT: 620,
  CANVAS_INNER_WIDTH: 2400,
  FIXED_CENTER_X: 1200,
  // Ground = буквально низ карточки (нет отступа) — по умолчанию совпадает с нижней
  // границей экспорта, но остаётся отдельной, отдельно двигаемой линией на случай,
  // если для конкретного фото нужно иначе. Фото по умолчанию тоже масштабируется
  // на всю высоту холста — от верхней границы карточки до нижней, без зазоров.
  FIXED_GROUND_Y: 620,
  VIEW_KEYS: ['side', 'front', '34front', '34rear', 'rear', 'custom1', 'custom2'],
  VIEW_LABELS: { side: 'Сбоку (силуэт)', front: 'Спереди', '34front': '3/4 спереди', '34rear': '3/4 сзади', rear: 'Сзади', custom1: 'Доп. 1', custom2: 'Доп. 2' },
  VERTICAL_LINES: ['head', 'cab1', 'center', 'cab2', 'trunk'],
  VERTICAL_LABELS: { head: 'Head', cab1: 'Cab 1', center: 'Center', cab2: 'Cab 2', trunk: 'Trunk' },
  VERTICAL_DEFAULTS: { head: -180, cab1: -70, center: 0, cab2: 70, trunk: 180 },
  VERTICAL_COLORS: { head: '#c0392b', cab1: '#d68910', center: '#6a5acd', cab2: '#1e8449', trunk: '#2471a3' },
  // Раздел «Колёса» — те же вертикальные линии (offsetX), но своя группа в легенде;
  // radius — пунктиром (по аналогии с вертикальными, просто другой border-style).
  WHEEL_LINES: ['front', 'rear', 'radius'],
  WHEEL_LABELS: { front: 'Front', rear: 'Rear', radius: 'Radius' },
  WHEEL_DEFAULTS: { front: -110, rear: 110, radius: -70 },
  WHEEL_COLORS: { front: '#117864', rear: '#7d3c98', radius: '#333333' },
  HORIZONTAL_LINES: ['ground', 'bottom', 'center', 'top'],
  HORIZONTAL_LABELS: { ground: 'Ground', bottom: 'Bottom', center: 'Center', top: 'Top' },
  // bottom не равен ground — иначе они лежат друг на друге и bottom физически не виден.
  HORIZONTAL_DEFAULTS: { ground: 0, bottom: -30, center: -140, top: -280 },
  HORIZONTAL_COLORS: { ground: '#8e44ad', bottom: '#16a085', center: '#e67e22', top: '#2c3e50' },
  DEFAULT_CARD_WIDTHS: [160, 220, 260, 320, 420],
  // ratioByKey — доля МЕНЬШЕЙ части от всего отрезка (для 2x1 меньшая часть — 1/3 и т.д.).
  // Без инверсии сначала идёт бОльшая часть (1 - ratioByKey), с инверсией — меньшая (ratioByKey).
  RATIO_ORDER: ['4x1', '7x2', '3x1', '2x1', 'hd', 'gold', 'a4', '4x3', '1x1'],
  RATIO_LABELS: { '4x1': '4:1', '7x2': '7:2', '3x1': '3:1', '2x1': '2:1', hd: '16:9 (HD)', gold: 'Золотое сечение', a4: '√2 (A4)', '4x3': '4:3', '1x1': '1:1' },
  RATIOS: { '4x1': 0.2, '7x2': 0.222222, '3x1': 0.25, '2x1': 0.3333, hd: 0.36, gold: 0.38198, a4: 0.4142, '4x3': 0.4286, '1x1': 0.5 },
  COUNTRIES: [
    { v: '', label: '— страна —' }, { v: '🇺🇸', label: '🇺🇸 США' }, { v: '🇯🇵', label: '🇯🇵 Япония' },
    { v: '🇩🇪', label: '🇩🇪 Германия' }, { v: '🇮🇹', label: '🇮🇹 Италия' }, { v: '🇬🇧', label: '🇬🇧 Великобритания' },
    { v: '🇫🇷', label: '🇫🇷 Франция' }, { v: '🇰🇷', label: '🇰🇷 Корея' }, { v: '🇷🇺', label: '🇷🇺 Россия' },
    { v: '🇸🇪', label: '🇸🇪 Швеция' }, { v: '🇨🇿', label: '🇨🇿 Чехия' }, { v: '🇦🇺', label: '🇦🇺 Австралия' },
  ],
  // Список стилей style-lab — руками (car-db намеренно не читает style-lab live).
  // Поменялись стили там — поправить и здесь.
  STYLES: ['Compact', 'America', 'Sport GT', 'Wedge', 'Offroad', 'Pro'],
};

App.State = {
  rootHandle: null,
  cardSizes: [160, 220, 260, 320, 420],
  cardDefaults: null, // {guides, cardWidth, style} — стартовые значения для новых машин
  cars: [],            // [{id, name, style, substyle, ...}]
  activeCarId: null,
  activeView: 'side',
  showOverlay: false,
  photoLocked: false, // лок перемещения фото на холсте (drag выключен, пока true)
  canvasZoom: 0.5,  // масштаб показа холста (сам холст логически всегда CANVAS_HEIGHT px)
  canvasScrollHeight: 600, // высота видимой области холста на экране — тянется за угол (resize: vertical), должна пережить renderAll

  lastFitKey: null, // под какое фото зум уже подгоняли — чтобы не подгонять повторно
  collapsedStyleGroups: new Set(), // какие папки-стили свёрнуты в списке машин
  sideTab: 'proportions', // правая панель вида «сбоку»: 'proportions' | 'rulers'
};

App.esc = s => (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
App.extOf = name => { let e = (name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, ''); return e || 'jpg'; };

// ──────────────────────────────────────────────
// FS — File System Access API (тот же паттерн, что в style-lab)
// ──────────────────────────────────────────────
App.FS = (function () {
  const DB_NAME = 'car-db-app', STORE = 'handles';
  function idbOpen() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function idbSet(key, val) {
    const db = await idbOpen();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(val, key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }
  async function idbGet(key) {
    const db = await idbOpen();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const rq = tx.objectStore(STORE).get(key);
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
  }
  async function pickFolder() {
    const handle = await window.showDirectoryPicker({ id: 'car-db-data', mode: 'readwrite' });
    await idbSet('root', handle);
    return handle;
  }
  async function restoreFolder() {
    try {
      const handle = await idbGet('root');
      if (!handle) return null;
      const perm = await handle.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') return handle;
      return { needsPermission: true, handle };
    } catch (e) { return null; }
  }
  async function ensurePermission(handle) {
    const perm = await handle.requestPermission({ mode: 'readwrite' });
    return perm === 'granted';
  }
  async function readText(fileHandle) { const f = await fileHandle.getFile(); return await f.text(); }
  async function writeText(fileHandle, text) { const w = await fileHandle.createWritable(); await w.write(text); await w.close(); }
  async function writeBytes(fileHandle, bytes) { const w = await fileHandle.createWritable(); await w.write(bytes); await w.close(); }
  async function getJSON(dirHandle, name, fallback) {
    try { const fh = await dirHandle.getFileHandle(name); return JSON.parse(await readText(fh)); }
    catch (e) { return fallback; }
  }
  async function setJSON(dirHandle, name, obj) {
    const fh = await dirHandle.getFileHandle(name, { create: true });
    await writeText(fh, JSON.stringify(obj, null, 2));
  }
  async function getDirOpt(parent, name) { try { return await parent.getDirectoryHandle(name); } catch (e) { return null; } }
  async function ensureDir(parent, name) { return await parent.getDirectoryHandle(name, { create: true }); }

  return { pickFolder, restoreFolder, ensurePermission, readText, writeText, writeBytes, getJSON, setJSON, getDirOpt, ensureDir };
})();
// ──────────────────────────────────────────────
// Drag — общий помощник для перетаскивания (pointer events)
// ──────────────────────────────────────────────
App.Drag = function (el, opts) {
  el.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation();
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
    const startX = e.clientX, startY = e.clientY;
    // Мышь двигается в экранных пикселях, а холст может быть отмасштабирован (zoom) —
    // переводим дельту в логические пиксели .canvas-inner, иначе при zoom != 1 всё
    // будет двигаться быстрее/медленнее курсора.
    const scale = (typeof opts.scale === 'function' ? opts.scale() : opts.scale) || 1;
    function move(ev) {
      const dx = opts.axis === 'y' ? 0 : (ev.clientX - startX) / scale;
      const dy = opts.axis === 'x' ? 0 : (ev.clientY - startY) / scale;
      opts.onDrag(dx, dy);
    }
    function up() {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      if (opts.onEnd) opts.onEnd();
    }
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  });
};
