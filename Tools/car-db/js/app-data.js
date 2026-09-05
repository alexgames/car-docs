// ──────────────────────────────────────────────
// Data — машины, фото, разметка, экспорт
// ──────────────────────────────────────────────
App.Data = (function () {
  const C = App.Const;

  function defaultRulers() {
    return {
      // По умолчанию концы совпадают с head/trunk (горизонтальная) и top/ground
      // (вертикальная) — дальше их можно тащить независимо, средняя точка не тянется,
      // она всегда вычисляется по выбранному соотношению между текущими концами.
      horizontal: { enabled: false, startOffsetX: C.VERTICAL_DEFAULTS.head, endOffsetX: C.VERTICAL_DEFAULTS.trunk, ratioKey: 'gold', invert: false },
      vertical: { enabled: false, startOffsetY: C.HORIZONTAL_DEFAULTS.top, endOffsetY: C.HORIZONTAL_DEFAULTS.ground, ratioKey: 'gold', invert: false },
    };
  }
  function defaultGuides() {
    // Если кто-то уже сохранил «карточку по умолчанию» (кнопка в легенде) — берём разметку
    // оттуда, иначе — встроенные константы. Общий конфиг на все машины (cardDefaults.json).
    if (App.State.cardDefaults && App.State.cardDefaults.guides) return JSON.parse(JSON.stringify(App.State.cardDefaults.guides));
    const vertical = {}; C.VERTICAL_LINES.forEach(k => vertical[k] = { offsetX: C.VERTICAL_DEFAULTS[k], visible: true });
    const horizontal = {}; C.HORIZONTAL_LINES.forEach(k => horizontal[k] = { offsetY: C.HORIZONTAL_DEFAULTS[k], visible: true });
    const wheels = {}; C.WHEEL_LINES.forEach(k => wheels[k] = { offsetX: C.WHEEL_DEFAULTS[k], visible: true });
    return { vertical, horizontal, wheels, rulers: defaultRulers() };
  }
  // Заменяет старую «Сохранить линии по умолчанию» — сохраняет сразу разметку, ширину
  // карточки, базовый стиль и подстиль как стартовые значения для НОВЫХ машин.
  async function saveCardDefaults(guides, cardWidth, style, substyle) {
    App.State.cardDefaults = { guides: JSON.parse(JSON.stringify(guides)), cardWidth, style, substyle };
    await App.FS.setJSON(App.State.rootHandle, 'cardDefaults.json', App.State.cardDefaults);
  }
  function defaultView(key) {
    return {
      draft: [], activeSel: null, final: null, lastExport: null,
      customLabel: key === 'custom1' ? 'Доп. 1' : (key === 'custom2' ? 'Доп. 2' : undefined),
      guides: key === 'side' ? defaultGuides() : undefined,
    };
  }
  function defaultCar(id) {
    const views = {};
    C.VIEW_KEYS.forEach(k => views[k] = defaultView(k));
    const d = App.State.cardDefaults;
    return {
      id, name: 'Новая машина', style: (d && d.style) || '', substyle: (d && d.substyle) || '', usageLinks: [],
      descShort: '', descHistorical: '', country: '', designer: '', favorite: false,
      cardWidth: (d && d.cardWidth) || App.State.cardSizes[0] || 260, views,
    };
  }

  async function nextId(prefix) {
    // Отдельное имя файла (не _meta.json) — чтобы можно было открыть в car-db и
    // style-lab одну и ту же папку data и не смешать их счётчики id.
    const meta = await App.FS.getJSON(App.State.rootHandle, '_meta_cars.json', { counter: 0 });
    meta.counter = (meta.counter || 0) + 1;
    await App.FS.setJSON(App.State.rootHandle, '_meta_cars.json', meta);
    return prefix + String(meta.counter).padStart(4, '0');
  }

  async function loadAll() {
    const root = App.State.rootHandle;
    const sizesCfg = await App.FS.getJSON(root, 'cardSizes.json', null);
    if (!sizesCfg) { App.State.cardSizes = C.DEFAULT_CARD_WIDTHS.slice(); await App.FS.setJSON(root, 'cardSizes.json', { sizes: App.State.cardSizes }); }
    else App.State.cardSizes = sizesCfg.sizes || C.DEFAULT_CARD_WIDTHS.slice();
    // null, если ещё никто не сохранял — тогда defaultGuides()/defaultCar() берут встроенные
    // константы. Миграция со старого guideDefaults.json (хранил только разметку, без
    // ширины/стиля) — если нового файла ещё нет, но старый есть, оборачиваем его.
    App.State.cardDefaults = await App.FS.getJSON(root, 'cardDefaults.json', null);
    if (!App.State.cardDefaults) {
      const legacyGuides = await App.FS.getJSON(root, 'guideDefaults.json', null);
      if (legacyGuides) App.State.cardDefaults = { guides: legacyGuides, cardWidth: null, style: '', substyle: '' };
    }

    App.State.cars = [];
    const carsDir = await App.FS.getDirOpt(root, 'cars');
    if (carsDir) {
      for await (const [name, handle] of carsDir.entries()) {
        if (handle.kind !== 'file' || !name.toLowerCase().endsWith('.json')) continue;
        try {
          const car = JSON.parse(await App.FS.readText(handle));
          car._handle = handle;
          // на случай старых карточек без части ракурсов/полей — докладываем дефолты
          C.VIEW_KEYS.forEach(k => { if (!car.views[k]) car.views[k] = defaultView(k); });
          if (car.views.side.guides && !car.views.side.guides.rulers) car.views.side.guides.rulers = defaultRulers();
          if (car.views.side.guides && !car.views.side.guides.wheels) {
            const wheels = {}; C.WHEEL_LINES.forEach(k => wheels[k] = { offsetX: C.WHEEL_DEFAULTS[k], visible: true });
            car.views.side.guides.wheels = wheels;
          }
          App.State.cars.push(car);
        } catch (e) { console.warn('bad car file', name, e); }
      }
    }
    App.State.cars.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
  }

  async function saveCardSizes() { await App.FS.setJSON(App.State.rootHandle, 'cardSizes.json', { sizes: App.State.cardSizes }); }

  async function saveCar(car) {
    const carsDir = await App.FS.ensureDir(App.State.rootHandle, 'cars');
    const fh = await carsDir.getFileHandle(car.id + '.json', { create: true });
    car._handle = fh;
    const clean = Object.assign({}, car); delete clean._handle;
    await App.FS.writeText(fh, JSON.stringify(clean, null, 2));
  }

  async function createCar() {
    const id = await nextId('car');
    const car = defaultCar(id);
    await saveCar(car);
    App.State.cars.push(car);
    App.State.cars.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
    return car;
  }

  async function deleteCar(car) {
    const carsDir = await App.FS.ensureDir(App.State.rootHandle, 'cars');
    try { await carsDir.removeEntry(car.id + '.json'); } catch (e) {}
    try {
      const photosRoot = await App.FS.getDirOpt(App.State.rootHandle, 'photos');
      if (photosRoot) await photosRoot.removeEntry(car.id, { recursive: true });
    } catch (e) {}
    App.State.cars = App.State.cars.filter(c => c.id !== car.id);
  }

  async function viewDirEnsure(carId, viewKey) {
    const photosRoot = await App.FS.ensureDir(App.State.rootHandle, 'photos');
    const carDir = await App.FS.ensureDir(photosRoot, carId);
    return await App.FS.ensureDir(carDir, viewKey);
  }

  async function getPhotoFile(carId, viewKey, sub, filename) {
    try {
      const photosRoot = await App.FS.getDirOpt(App.State.rootHandle, 'photos'); if (!photosRoot) return null;
      const carDir = await App.FS.getDirOpt(photosRoot, carId); if (!carDir) return null;
      const vDir = await App.FS.getDirOpt(carDir, viewKey); if (!vDir) return null;
      const dir = sub ? await App.FS.getDirOpt(vDir, sub) : vDir;
      if (!dir) return null;
      const fh = await dir.getFileHandle(filename);
      return await fh.getFile();
    } catch (e) { return null; }
  }

  // Ровно во всю высоту холста (между верхней и нижней границей карточки), без
  // ограничения «не апскейлить», даже если оригинал меньше.
  function fitScale(bitmap) { return C.CANVAS_HEIGHT / bitmap.height; }

  async function addDraftPhoto(car, viewKey, file) {
    const vd = await viewDirEnsure(car.id, viewKey);
    const dd = await App.FS.ensureDir(vd, 'draft');
    const view = car.views[viewKey];
    const idx = view.draft.length + 1;
    const fname = idx + '.' + App.extOf(file.name);
    const fh = await dd.getFileHandle(fname, { create: true });
    await App.FS.writeBytes(fh, await file.arrayBuffer());
    const bitmap = await createImageBitmap(file);
    view.draft.push({ file: fname, x: 0, y: 0, scale: fitScale(bitmap) });
    view.activeSel = { kind: 'draft', index: view.draft.length - 1 };
    await saveCar(car);
  }

  async function removeDraftPhoto(car, viewKey, idx) {
    const vd = await viewDirEnsure(car.id, viewKey);
    const dd = await App.FS.ensureDir(vd, 'draft');
    const view = car.views[viewKey];
    const item = view.draft[idx];
    if (item) { try { await dd.removeEntry(item.file); } catch (e) {} }
    view.draft.splice(idx, 1);
    if (view.activeSel && view.activeSel.kind === 'draft') {
      if (view.draft.length === 0) view.activeSel = view.final ? { kind: 'final' } : null;
      else if (view.activeSel.index >= view.draft.length) view.activeSel = { kind: 'draft', index: view.draft.length - 1 };
    }
    await saveCar(car);
  }

  async function setFinalPhoto(car, viewKey, file) {
    const vd = await viewDirEnsure(car.id, viewKey);
    const view = car.views[viewKey];
    if (view.final) { try { await vd.removeEntry(view.final.file); } catch (e) {} }
    const fname = 'final.' + App.extOf(file.name);
    const fh = await vd.getFileHandle(fname, { create: true });
    await App.FS.writeBytes(fh, await file.arrayBuffer());
    const bitmap = await createImageBitmap(file);
    view.final = { file: fname, x: 0, y: 0, scale: fitScale(bitmap) };
    view.activeSel = { kind: 'final' };
    await saveCar(car);
  }

  async function removeFinalPhoto(car, viewKey) {
    const vd = await viewDirEnsure(car.id, viewKey);
    const view = car.views[viewKey];
    if (view.final) { try { await vd.removeEntry(view.final.file); } catch (e) {} }
    view.final = null;
    if (view.activeSel && view.activeSel.kind === 'final') view.activeSel = view.draft.length ? { kind: 'draft', index: 0 } : null;
    await saveCar(car);
  }

  // ──────────────────────────────────────────────
  // Метрики пропорций (сбоку) — зеркалит analyze-proportions.mjs::metricsFor().
  // Держать в синхроне вручную: это браузерный JS без сборки, общий модуль с
  // Node-скриптом не подключить напрямую. Ничего не сохраняется отдельным конфигом —
  // считается на лету из уже загруженных в память car.views.side.guides, поэтому
  // не может протухнуть: открыл карточку/поменял разметку — тут же пересчиталось.
  // ──────────────────────────────────────────────
  const METRIC_LABELS = {
    lengthHeight: 'Длина / высота',
    hoodShare: 'Капот, % длины',
    cabinShare: 'Кабина, % длины',
    rearShare: 'Корма, % длины',
    wheelbaseShare: 'Колёсная база, % длины',
    frontOverhangShare: 'Передний свес, % длины',
    rearOverhangShare: 'Задний свес, % длины',
    centerFromFront: 'Центр от переда, % длины',
    cabinHeightShare: 'Кабина, % высоты',
    lowerBodyShareOfHeight: 'Низ кузова, % высоты',
    clearanceShareOfHeight: 'Клиренс, % высоты',
  };
  const METRIC_ORDER = Object.keys(METRIC_LABELS);
  const METRIC_IS_RATIO = { lengthHeight: true }; // остальные — доли (проценты)

  function carMetrics(car) {
    const guides = car.views && car.views.side && car.views.side.guides;
    const v = guides && guides.vertical, h = guides && guides.horizontal, w = guides && guides.wheels;
    if (!v || !h || !w) return null;
    const length = v.trunk.offsetX - v.head.offsetX;
    const height = h.ground.offsetY - h.top.offsetY;
    const wheelbase = w.rear.offsetX - w.front.offsetX;
    if (length <= 0 || height <= 0 || wheelbase <= 0) return null;
    const r = (a, b) => b === 0 ? null : a / b;
    return {
      lengthHeight: r(length, height),
      clearanceShareOfHeight: r(h.ground.offsetY - h.bottom.offsetY, height),
      lowerBodyShareOfHeight: r(h.bottom.offsetY - h.center.offsetY, height),
      cabinHeightShare: r(h.center.offsetY - h.top.offsetY, height),
      hoodShare: r(v.cab1.offsetX - v.head.offsetX, length),
      cabinShare: r(v.cab2.offsetX - v.cab1.offsetX, length),
      rearShare: r(v.trunk.offsetX - v.cab2.offsetX, length),
      wheelbaseShare: r(wheelbase, length),
      frontOverhangShare: r(w.front.offsetX - v.head.offsetX, length),
      rearOverhangShare: r(v.trunk.offsetX - w.rear.offsetX, length),
      centerFromFront: r(v.center.offsetX - v.head.offsetX, length),
    };
  }

  // Группа = машины с тем же (style, substyle). Считается прямо из App.State.cars —
  // всегда актуально, поменял/добавил/убрал машину из подстиля — среднее само другое
  // при следующем рендере, отдельно ничего инициировать не нужно.
  function substyleGroupMetrics(car) {
    if (!car.substyle) return null;
    const groupCars = App.State.cars.filter(c => (c.style || '') === (car.style || '') && c.substyle === car.substyle);
    const rows = groupCars.map(c => ({ car: c, metrics: carMetrics(c) })).filter(r => r.metrics);
    if (!rows.length) return null;
    const averages = {};
    METRIC_ORDER.forEach(key => {
      const values = rows.map(r => r.metrics[key]).filter(v => v !== null && v !== undefined);
      averages[key] = values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
    });
    return { groupCars: rows.map(r => r.car), count: rows.length, averages };
  }

  function activePhotoMeta(view) {
    const sel = view.activeSel;
    if (sel && sel.kind === 'final' && view.final) return { kind: 'final', meta: view.final };
    if (sel && sel.kind === 'draft' && view.draft[sel.index]) return { kind: 'draft', meta: view.draft[sel.index], index: sel.index };
    if (view.final) return { kind: 'final', meta: view.final };
    if (view.draft.length) return { kind: 'draft', meta: view.draft[0], index: 0 };
    return null;
  }

  async function exportView(car, viewKey) {
    const view = car.views[viewKey];
    const active = activePhotoMeta(view);
    if (!active) { alert('Нет фото для экспорта — добавьте драфт или финал.'); return false; }
    const sub = active.kind === 'draft' ? 'draft' : '';
    const file = await getPhotoFile(car.id, viewKey, sub, active.meta.file);
    if (!file) { alert('Не удалось прочитать файл фото.'); return false; }
    const bitmap = await createImageBitmap(file);
    const width = car.cardWidth || 260;
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = C.CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d');
    const dw = bitmap.width * active.meta.scale, dh = bitmap.height * active.meta.scale;
    const cx = width / 2 + active.meta.x, gy = C.FIXED_GROUND_Y + active.meta.y;
    ctx.drawImage(bitmap, cx - dw / 2, gy - dh, dw, dh);
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    const vd = await viewDirEnsure(car.id, viewKey);
    const fh = await vd.getFileHandle('export.png', { create: true });
    await App.FS.writeBytes(fh, await blob.arrayBuffer());
    view.lastExport = { width, at: new Date().toISOString() };
    await saveCar(car);
    return true;
  }

  function mimeFromExt(ext) {
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'webp') return 'image/webp';
    return 'image/png';
  }

  // Перезаписывает САМ файл активного фото зеркально по горизонтали (не превью,
  // не отдельная копия) — x/масштаб не трогаем: фото зеркалится вокруг своего же центра.
  async function flipPhotoHorizontal(car, viewKey) {
    const view = car.views[viewKey];
    const active = activePhotoMeta(view);
    if (!active) return false;
    const sub = active.kind === 'draft' ? 'draft' : '';
    const file = await getPhotoFile(car.id, viewKey, sub, active.meta.file);
    if (!file) return false;
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.translate(bitmap.width, 0); ctx.scale(-1, 1);
    ctx.drawImage(bitmap, 0, 0);
    const ext = App.extOf(active.meta.file);
    const blob = await new Promise(res => canvas.toBlob(res, mimeFromExt(ext), 0.95));
    const vd = await viewDirEnsure(car.id, viewKey);
    const dir = sub ? await App.FS.ensureDir(vd, sub) : vd;
    const fh = await dir.getFileHandle(active.meta.file, { create: true });
    await App.FS.writeBytes(fh, await blob.arrayBuffer());
    return true;
  }

  return {
    loadAll, saveCardSizes, saveCardDefaults, saveCar, createCar, deleteCar, viewDirEnsure, getPhotoFile,
    addDraftPhoto, removeDraftPhoto, setFinalPhoto, removeFinalPhoto, activePhotoMeta, exportView, flipPhotoHorizontal,
    defaultRulers, carMetrics, substyleGroupMetrics, METRIC_LABELS, METRIC_ORDER, METRIC_IS_RATIO,
  };
})();
