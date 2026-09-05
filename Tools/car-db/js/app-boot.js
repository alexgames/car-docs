function renderAll() { App.UI.renderAll(); }

// ──────────────────────────────────────────────
// Bootstrap
// ──────────────────────────────────────────────
async function loadFolder(handle) {
  App.State.rootHandle = handle;
  document.getElementById('folder-status').textContent = handle.name;
  await App.Data.loadAll();
  renderAll();
}

// Ширина списка машин — тянем за узкую полоску между списком и основной панелью.
// #car-list-panel статичен (не пересоздаётся при renderAll, в отличие от .canvas-scroll),
// поэтому inline-width, выставленный драгом, ничем не перебивается — ResizeObserver не нужен.
(function () {
  const panel = document.getElementById('car-list-panel');
  const handle = document.getElementById('car-list-resize-handle');
  const MIN_W = 180, MAX_W = 520;
  let startW = panel.getBoundingClientRect().width;
  handle.addEventListener('pointerdown', () => {
    startW = panel.getBoundingClientRect().width;
    handle.classList.add('dragging');
  });
  App.Drag(handle, {
    onDrag: dx => { panel.style.width = Math.max(MIN_W, Math.min(MAX_W, startW + dx)) + 'px'; },
    onEnd: () => handle.classList.remove('dragging'),
  });
})();

document.getElementById('btn-open').addEventListener('click', async () => {
  try { const handle = await App.FS.pickFolder(); await loadFolder(handle); } catch (e) {}
});
document.getElementById('btn-new-car').addEventListener('click', async () => {
  const car = await App.Data.createCar();
  App.State.activeCarId = car.id;
  App.State.activeView = 'side';
  renderAll();
});

renderAll(); // скрыть левую панель, пока папка data не выбрана

(async function boot() {
  const restored = await App.FS.restoreFolder();
  if (!restored) return;
  if (restored.needsPermission) {
    document.getElementById('folder-status').textContent = 'нажмите «Открыть папку data», чтобы восстановить доступ';
    return;
  }
  await loadFolder(restored);
})();
