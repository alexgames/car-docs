App.UI = (function () {
  const C = App.Const;

  function activeCar() { return App.State.cars.find(c => c.id === App.State.activeCarId) || null; }

  function carListItem(car) {
    const div = document.createElement('div');
    div.className = 'car-list-item' + (car.id === App.State.activeCarId ? ' active' : '');

    const thumb = document.createElement('div'); thumb.className = 'car-item-thumb';
    div.appendChild(thumb);

    const info = document.createElement('div'); info.className = 'car-item-info';
    const starMark = car.favorite ? '<span class="car-item-star">★</span> ' : '';
    info.innerHTML = `<div class="car-item-name">${starMark}${App.esc(car.name || '(без названия)')}</div>` +
      `<div class="car-item-sub"><span class="car-item-id">${App.esc(car.id)}</span></div>`;
    div.appendChild(info);

    div.addEventListener('click', () => { App.State.activeCarId = car.id; App.State.activeView = 'side'; renderAll(); });

    // Превью — активное фото вида «сбоку» (финал в приоритете, иначе первый драфт).
    // Загружается асинхронно поверх уже отрисованного списка, чтобы не тормозить
    // рендер чтением файлов сразу по всем машинам.
    const view = car.views && car.views.side;
    const active = view && App.Data.activePhotoMeta(view);
    if (active) {
      const sub = active.kind === 'draft' ? 'draft' : '';
      App.Data.getPhotoFile(car.id, 'side', sub, active.meta.file).then(f => {
        if (!f) return;
        const img = document.createElement('img');
        img.src = URL.createObjectURL(f);
        thumb.appendChild(img);
      });
    }

    return div;
  }

  function collapsibleGroup(key, label, count, extraClass) {
    const details = document.createElement('details');
    details.className = 'car-group' + (extraClass ? ' ' + extraClass : '');
    details.open = !App.State.collapsedStyleGroups.has(key);
    details.addEventListener('toggle', () => {
      if (details.open) App.State.collapsedStyleGroups.delete(key);
      else App.State.collapsedStyleGroups.add(key);
    });
    const summary = document.createElement('summary');
    summary.textContent = label + ' (' + count + ')';
    details.appendChild(summary);
    return details;
  }

  // Группы-«папки» по стилю (сворачиваемые), а не фильтр — так видно сразу всю базу,
  // не нужно переключать туда-обратно. Порядок групп — как в App.Const.STYLES,
  // без стиля — отдельной группой в конце. Пустые группы (0 машин) не показываем.
  // Внутри стиля — если есть подстиль, машина уходит во вложенную подпапку по
  // подстилю (сворачиваемую так же); без подстиля — лежит прямо в папке стиля.
  function renderCarList() {
    const wrap = document.getElementById('car-list');
    wrap.innerHTML = '';
    const groupKeys = C.STYLES.concat(['']);
    const groupLabels = Object.assign({}, ...C.STYLES.map(s => ({ [s]: s })), { '': 'Без стиля' });
    groupKeys.forEach(styleKey => {
      const cars = App.State.cars.filter(c => (c.style || '') === styleKey);
      if (!cars.length) return;
      const details = collapsibleGroup(styleKey, groupLabels[styleKey], cars.length);

      // Избранные — первыми внутри каждой (под)группы; sort стабильный, так что порядок
      // по id (уже отсортирован в App.State.cars) внутри «избранное»/«не избранное»
      // не ломается — только звёздочки всплывают наверх.
      const byFavorite = (a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);

      // Подкатегории (подстиль) — сверху внутри категории, машины без подстиля — ниже них.
      const bySub = new Map();
      cars.forEach(c => { if (c.substyle) { if (!bySub.has(c.substyle)) bySub.set(c.substyle, []); bySub.get(c.substyle).push(c); } });
      Array.from(bySub.keys()).sort((a, b) => a.localeCompare(b, 'ru')).forEach(sub => {
        const subCars = bySub.get(sub).sort(byFavorite);
        const subDetails = collapsibleGroup('sub:' + styleKey + '|' + sub, sub, subCars.length, 'car-subgroup');
        subCars.forEach(car => subDetails.appendChild(carListItem(car)));
        details.appendChild(subDetails);
      });

      const noSub = cars.filter(c => !c.substyle).sort(byFavorite);
      noSub.forEach(car => details.appendChild(carListItem(car)));

      wrap.appendChild(details);
    });
  }

  function fieldRow(labelText, inputEl) {
    const row = document.createElement('div');
    row.className = 'field-row';
    const label = document.createElement('label');
    label.textContent = labelText;
    row.appendChild(label);
    row.appendChild(inputEl);
    return row;
  }

  function renderCarForm(car, container) {
    const nameInput = document.createElement('input');
    nameInput.type = 'text'; nameInput.id = 'car-name-input'; nameInput.value = car.name || '';
    nameInput.placeholder = 'Марка Модель Год';
    nameInput.oninput = () => {
      car.name = nameInput.value;
      const item = document.querySelector('.car-list-item.active .car-item-name');
      if (item) item.textContent = car.name || '(без названия)';
    };
    nameInput.onblur = () => App.Data.saveCar(car);
    nameInput.style.flex = '1';

    const starBtn = document.createElement('button');
    starBtn.type = 'button';
    starBtn.className = 'fav-star-btn' + (car.favorite ? ' active' : '');
    starBtn.textContent = car.favorite ? '★' : '☆';
    starBtn.title = car.favorite ? 'Убрать из избранного' : 'Добавить в избранное';
    starBtn.addEventListener('click', () => {
      car.favorite = !car.favorite;
      starBtn.classList.toggle('active', car.favorite);
      starBtn.textContent = car.favorite ? '★' : '☆';
      starBtn.title = car.favorite ? 'Убрать из избранного' : 'Добавить в избранное';
      App.Data.saveCar(car);
      renderCarList();
    });

    const nameWrap = document.createElement('div');
    nameWrap.style.cssText = 'display:flex;align-items:center;gap:8px;';
    nameWrap.appendChild(starBtn);
    nameWrap.appendChild(nameInput);
    const nameRow = fieldRow('Название (марка-модель-год)', nameWrap);
    const idBadge = document.createElement('span');
    idBadge.textContent = car.id;
    idBadge.title = 'id машины — так называется её файл: cars/' + car.id + '.json и папка фото photos/' + car.id;
    idBadge.style.cssText = 'display:inline-block;margin-top:5px;font-family:monospace;font-size:11px;color:#999;';
    nameRow.appendChild(idBadge);
    container.appendChild(nameRow);

    const grid = document.createElement('div');
    grid.className = 'field-grid';
    const mk = (labelText, key, placeholder) => {
      const inp = document.createElement('input');
      inp.type = 'text'; inp.value = car[key] || ''; inp.placeholder = placeholder || '';
      inp.oninput = () => { car[key] = inp.value; };
      inp.onblur = () => { App.Data.saveCar(car); renderCarList(); }; // подстиль виден в списке слева
      grid.appendChild(fieldRow(labelText, inp));
    };
    const styleSelect = document.createElement('select');
    const styleOpt0 = document.createElement('option'); styleOpt0.value = ''; styleOpt0.textContent = '— стиль —';
    styleSelect.appendChild(styleOpt0);
    C.STYLES.forEach(s => {
      const opt = document.createElement('option'); opt.value = s; opt.textContent = s;
      if (car.style === s) opt.selected = true;
      styleSelect.appendChild(opt);
    });
    styleSelect.onchange = () => { car.style = styleSelect.value; App.Data.saveCar(car); renderAll(); };
    grid.appendChild(fieldRow('Стиль', styleSelect));
    mk('Подстиль', 'substyle', 'Fin Tail');

    const countrySelect = document.createElement('select');
    C.COUNTRIES.forEach(c => {
      const opt = document.createElement('option'); opt.value = c.v; opt.textContent = c.label;
      if ((car.country || '') === c.v) opt.selected = true;
      countrySelect.appendChild(opt);
    });
    countrySelect.onchange = () => { car.country = countrySelect.value; App.Data.saveCar(car); };
    grid.appendChild(fieldRow('Страна происхождения', countrySelect));

    const designerInput = document.createElement('input');
    designerInput.type = 'text'; designerInput.value = car.designer || ''; designerInput.placeholder = 'необязательно';
    designerInput.oninput = () => { car.designer = designerInput.value; };
    designerInput.onblur = () => App.Data.saveCar(car);
    grid.appendChild(fieldRow('Дизайнер / бюро', designerInput));
    container.appendChild(grid);

    // связи использования
    const usageWrap = document.createElement('div');
    usageWrap.className = 'field-row';
    const usageLabel = document.createElement('label'); usageLabel.textContent = 'Связи с использованием (стиль → категория, задание)';
    usageWrap.appendChild(usageLabel);
    const usageList = document.createElement('div');
    usageWrap.appendChild(usageList);
    function renderUsage() {
      usageList.innerHTML = '';
      (car.usageLinks || []).forEach((link, i) => {
        const row = document.createElement('div'); row.className = 'usage-row';
        const s = document.createElement('select'); s.style.flex = '1';
        const sOpt0 = document.createElement('option'); sOpt0.value = ''; sOpt0.textContent = '— стиль —';
        s.appendChild(sOpt0);
        C.STYLES.forEach(st => {
          const opt = document.createElement('option'); opt.value = st; opt.textContent = st;
          if (link.style === st) opt.selected = true;
          s.appendChild(opt);
        });
        s.onchange = () => { link.style = s.value; App.Data.saveCar(car); };
        const c = document.createElement('input'); c.placeholder = 'категория (Inspire)'; c.value = link.category || '';
        c.oninput = () => { link.category = c.value; }; c.onblur = () => App.Data.saveCar(car);
        const n = document.createElement('input'); n.placeholder = 'заметка / задание'; n.value = link.note || '';
        n.oninput = () => { link.note = n.value; }; n.onblur = () => App.Data.saveCar(car);
        const del = document.createElement('button'); del.textContent = '×';
        del.addEventListener('click', () => { car.usageLinks.splice(i, 1); renderUsage(); App.Data.saveCar(car); });
        row.appendChild(s); row.appendChild(c); row.appendChild(n); row.appendChild(del);
        usageList.appendChild(row);
      });
    }
    renderUsage();
    const addUsageBtn = document.createElement('button'); addUsageBtn.id = 'btn-add-usage'; addUsageBtn.textContent = '+ связь';
    addUsageBtn.addEventListener('click', () => { car.usageLinks = car.usageLinks || []; car.usageLinks.push({ style: '', category: '', note: '' }); renderUsage(); App.Data.saveCar(car); });
    usageWrap.appendChild(addUsageBtn);
    container.appendChild(usageWrap);

    const grid2 = document.createElement('div');
    grid2.className = 'field-grid-2';
    const mkTa = (labelText, key) => {
      const ta = document.createElement('textarea'); ta.value = car[key] || '';
      ta.oninput = () => { car[key] = ta.value; };
      ta.onblur = () => App.Data.saveCar(car);
      grid2.appendChild(fieldRow(labelText, ta));
    };
    mkTa('Описание дизайна (короткое)', 'descShort');
    mkTa('Историческое описание', 'descHistorical');
    container.appendChild(grid2);

    // размер карточки
    const widthRow = document.createElement('div'); widthRow.className = 'field-row';
    const widthLabel = document.createElement('label'); widthLabel.textContent = 'Размер карточки (ширина)';
    widthRow.appendChild(widthLabel);
    const widthInner = document.createElement('div'); widthInner.style.display = 'flex'; widthInner.style.gap = '8px'; widthInner.style.alignItems = 'center';
    const widthSelect = document.createElement('select'); widthSelect.style.width = '140px';
    App.State.cardSizes.forEach(w => {
      const opt = document.createElement('option'); opt.value = w; opt.textContent = w + ' px';
      if (car.cardWidth === w) opt.selected = true;
      widthSelect.appendChild(opt);
    });
    widthSelect.onchange = () => { car.cardWidth = parseInt(widthSelect.value, 10); App.Data.saveCar(car); renderAll(); };
    const editSizesBtn = document.createElement('button'); editSizesBtn.textContent = 'изменить набор ширин';
    editSizesBtn.style.cssText = 'font-size:11px;padding:6px 10px;border-radius:8px;border:1px solid #ccc;background:#fff;cursor:pointer;';
    editSizesBtn.addEventListener('click', async () => {
      const cur = App.State.cardSizes.join(', ');
      const raw = prompt('Ширины через запятую (px), общие для всех карточек:', cur);
      if (raw == null) return;
      const sizes = raw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
      if (!sizes.length) return;
      App.State.cardSizes = sizes;
      await App.Data.saveCardSizes();
      renderAll();
    });
    widthInner.appendChild(widthSelect); widthInner.appendChild(editSizesBtn);
    widthRow.appendChild(widthInner);
    container.appendChild(widthRow);

    const actions = document.createElement('div'); actions.className = 'card-actions';
    const delBtn = document.createElement('button'); delBtn.id = 'btn-delete-car'; delBtn.textContent = 'Удалить карточку';
    delBtn.addEventListener('click', async () => {
      if (!confirm('Удалить карточку «' + (car.name || '') + '» вместе со всеми фото?')) return;
      await App.Data.deleteCar(car);
      App.State.activeCarId = null;
      renderAll();
    });
    actions.appendChild(delBtn);
    container.appendChild(actions);
  }

  function renderViewTabs(car, container) {
    const tabs = document.createElement('div'); tabs.id = 'view-tabs';
    C.VIEW_KEYS.forEach(key => {
      const isCustom = key === 'custom1' || key === 'custom2';
      let el;
      if (isCustom) {
        el = document.createElement('input');
        el.className = 'view-tab-custom-input' + (App.State.activeView === key ? ' active' : '');
        el.value = car.views[key].customLabel || C.VIEW_LABELS[key];
        el.oninput = () => { car.views[key].customLabel = el.value; };
        el.onblur = () => App.Data.saveCar(car);
        // Перерендер только при переключении на ДРУГУЮ вкладку — иначе клик в это же
        // поле (чтобы переименовать) каждый раз пересоздаёт input и сбрасывает фокус.
        el.addEventListener('click', () => { if (App.State.activeView !== key) { App.State.activeView = key; renderAll(); } });
      } else {
        el = document.createElement('button');
        el.className = 'view-tab' + (App.State.activeView === key ? ' active' : '');
        el.textContent = C.VIEW_LABELS[key];
        el.addEventListener('click', () => { if (App.State.activeView !== key) { App.State.activeView = key; renderAll(); } });
      }
      tabs.appendChild(el);
    });
    container.appendChild(tabs);
  }

  function draftThumb(car, viewKey, item, idx, view) {
    const div = document.createElement('div');
    const active = view.activeSel && view.activeSel.kind === 'draft' && view.activeSel.index === idx;
    div.className = 'draft-thumb' + (active ? ' active' : '');
    const img = document.createElement('img');
    div.appendChild(img);
    App.Data.getPhotoFile(car.id, viewKey, 'draft', item.file).then(f => { if (f) img.src = URL.createObjectURL(f); });
    const del = document.createElement('button'); del.className = 'thumb-del'; del.textContent = '×';
    del.addEventListener('click', async e => { e.stopPropagation(); await App.Data.removeDraftPhoto(car, viewKey, idx); renderAll(); });
    div.appendChild(del);
    div.addEventListener('click', async () => { view.activeSel = { kind: 'draft', index: idx }; await App.Data.saveCar(car); renderAll(); });
    return div;
  }

  function renderPhotoCols(car, viewKey, container) {
    const view = car.views[viewKey];
    const cols = document.createElement('div'); cols.className = 'photo-cols';

    const draftCol = document.createElement('div');
    const draftHead = document.createElement('div'); draftHead.className = 'photo-col-head'; draftHead.textContent = 'Драфт (для работы в редакторе, любые фото)';
    draftCol.appendChild(draftHead);
    const strip = document.createElement('div'); strip.className = 'draft-strip';
    view.draft.forEach((item, idx) => strip.appendChild(draftThumb(car, viewKey, item, idx, view)));
    const addDrop = document.createElement('div'); addDrop.className = 'mini-drop'; addDrop.textContent = '+'; addDrop.title = 'Добавить драфт-фото';
    wireDropZone(addDrop, async files => { for (const f of files) await App.Data.addDraftPhoto(car, viewKey, f); renderAll(); });
    strip.appendChild(addDrop);
    draftCol.appendChild(strip);
    cols.appendChild(draftCol);

    const finalCol = document.createElement('div'); finalCol.className = 'final-slot';
    const finalHead = document.createElement('div'); finalHead.className = 'photo-col-head'; finalHead.textContent = 'Финал (в билд)';
    finalCol.appendChild(finalHead);
    if (view.final) {
      const active = view.activeSel && view.activeSel.kind === 'final';
      const div = document.createElement('div'); div.className = 'draft-thumb' + (active ? ' active' : '');
      const img = document.createElement('img'); div.appendChild(img);
      App.Data.getPhotoFile(car.id, viewKey, '', view.final.file).then(f => { if (f) img.src = URL.createObjectURL(f); });
      const del = document.createElement('button'); del.className = 'thumb-del'; del.textContent = '×';
      del.addEventListener('click', async e => { e.stopPropagation(); await App.Data.removeFinalPhoto(car, viewKey); renderAll(); });
      div.appendChild(del);
      div.addEventListener('click', async () => { view.activeSel = { kind: 'final' }; await App.Data.saveCar(car); renderAll(); });
      finalCol.appendChild(div);
    } else {
      const drop = document.createElement('div'); drop.className = 'mini-drop'; drop.textContent = '+'; drop.title = 'Загрузить финальное фото';
      wireDropZone(drop, async files => { if (files[0]) { await App.Data.setFinalPhoto(car, viewKey, files[0]); renderAll(); } });
      finalCol.appendChild(drop);
    }
    cols.appendChild(finalCol);

    container.appendChild(cols);
  }

  function wireDropZone(el, onFiles) {
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over'); });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', e => {
      e.preventDefault(); el.classList.remove('drag-over');
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      if (files.length) onFiles(files);
    });
    el.addEventListener('click', () => {
      const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.multiple = true;
      input.addEventListener('change', () => { if (input.files.length) onFiles(Array.from(input.files)); });
      input.click();
    });
  }

  function renderCanvas(car, viewKey, container) {
    const C_ = App.Const;
    const view = car.views[viewKey];
    const isSide = viewKey === 'side';

    const toolbar = document.createElement('div'); toolbar.className = 'canvas-toolbar';
    const exportBtn = document.createElement('button'); exportBtn.className = 'primary'; exportBtn.textContent = 'Экспортировать';
    exportBtn.title = 'Ширина карточки: ' + (car.cardWidth || 260) + 'px (см. оранжевые линии на холсте)';
    exportBtn.addEventListener('click', async () => { const ok = await App.Data.exportView(car, viewKey); renderAll(); });
    toolbar.appendChild(exportBtn);

    const zoomWrap = document.createElement('div'); zoomWrap.className = 'zoom-controls';
    const zoomOut = document.createElement('button'); zoomOut.textContent = '−'; zoomOut.title = 'Уменьшить масштаб холста';
    zoomOut.addEventListener('click', () => { App.State.canvasZoom = Math.max(0.15, Math.round((App.State.canvasZoom - 0.1) * 100) / 100); renderAll(); });
    const zoomLevel = document.createElement('span'); zoomLevel.id = 'zoom-level'; zoomLevel.textContent = Math.round(App.State.canvasZoom * 100) + '%';
    const zoomIn = document.createElement('button'); zoomIn.textContent = '+'; zoomIn.title = 'Увеличить масштаб холста';
    zoomIn.addEventListener('click', () => { App.State.canvasZoom = Math.min(2, Math.round((App.State.canvasZoom + 0.1) * 100) / 100); renderAll(); });
    const fitZoomBtn = document.createElement('button'); fitZoomBtn.textContent = 'Фит';
    fitZoomBtn.title = 'Подобрать масштаб холста так, чтобы вся машина влезла по ширине и высоте, с запасом';
    zoomWrap.appendChild(zoomOut); zoomWrap.appendChild(zoomLevel); zoomWrap.appendChild(zoomIn); zoomWrap.appendChild(fitZoomBtn);
    toolbar.appendChild(zoomWrap);
    const overlayLabel = document.createElement('label'); overlayLabel.className = 'chk';
    const overlayChk = document.createElement('input'); overlayChk.type = 'checkbox'; overlayChk.checked = App.State.showOverlay;
    overlayChk.onchange = () => { App.State.showOverlay = overlayChk.checked; renderAll(); };
    overlayLabel.appendChild(overlayChk); overlayLabel.appendChild(document.createTextNode(' показать экспортированный финал поверх'));
    toolbar.appendChild(overlayLabel);
    const lockBtn = document.createElement('button');
    lockBtn.textContent = App.State.photoLocked ? '🔒 Фото заблокировано' : '🔓 Лок перемещения фото';
    lockBtn.title = 'Вкл/выкл перетаскивание фото на холсте — чтобы случайно не сдвинуть, когда позиция уже выставлена';
    lockBtn.addEventListener('click', () => { App.State.photoLocked = !App.State.photoLocked; renderAll(); });
    toolbar.appendChild(lockBtn);
    const status = document.createElement('span'); status.id = 'export-status';
    status.textContent = view.lastExport ? ('экспорт: ' + view.lastExport.width + 'px, ' + new Date(view.lastExport.at).toLocaleString('ru')) : 'ещё не экспортировано';
    toolbar.appendChild(status);
    container.appendChild(toolbar);

    const area = document.createElement('div'); area.className = 'canvas-area';
    const scroll = document.createElement('div'); scroll.className = 'canvas-scroll';
    scroll.style.height = App.State.canvasScrollHeight + 'px';
    // Элемент пересоздаётся на каждый renderAll — без этого ручной resize (угол снизу
    // справа) сбрасывался бы обратно к дефолтной высоте при первом же клике/зуме/смене
    // вкладки. ResizeObserver переживает пересоздание, т.к. навешивается заново на новый
    // scroll и просто перечитывает App.State при следующем рендере.
    new ResizeObserver(entries => {
      const h = Math.round(entries[0].contentRect.height);
      if (h > 0 && h !== App.State.canvasScrollHeight) App.State.canvasScrollHeight = h;
    }).observe(scroll);
    const inner = document.createElement('div'); inner.className = 'canvas-inner';
    inner.style.zoom = App.State.canvasZoom;

    // Подбираем zoom так, чтобы активное фото по ширине и вся карточка по высоте
    // влезли в контейнер холста, с запасом (90% доступного места). Общая функция —
    // и для кнопки «Фит», и для автовызова при открытии карточки / смене фото.
    async function runFit(silent) {
      const a = App.Data.activePhotoMeta(view);
      if (!a) { if (!silent) alert('Нет активного фото — нечего вписывать.'); return; }
      const sub = a.kind === 'draft' ? 'draft' : '';
      const file = await App.Data.getPhotoFile(car.id, viewKey, sub, a.meta.file);
      if (!file) return;
      const bmp = await createImageBitmap(file);
      const photoW = bmp.width * a.meta.scale;
      const margin = 0.9;
      const zByWidth = (scroll.clientWidth * margin) / photoW;
      const zByHeight = (scroll.clientHeight * margin) / C_.CANVAS_HEIGHT;
      let z = Math.min(zByWidth, zByHeight);
      z = Math.max(0.15, Math.min(2, Math.round(z * 100) / 100));
      App.State.canvasZoom = z;
      renderAll();
    }
    fitZoomBtn.addEventListener('click', () => runFit(false));

    // Автофит: как только показанное фото (карточка/ракурс/драфт-или-финал/файл)
    // отличается от того, под что зум подбирали в прошлый раз — подгоняем заново.
    // Сравнение по ключу, а не «при каждом рендере», иначе автофит перебивал бы
    // ручные +/− и слайдер масштаба фото при каждом их клике.
    {
      const a = App.Data.activePhotoMeta(view);
      const fitKey = a ? [car.id, viewKey, a.kind, a.index ?? '', a.meta.file].join('|') : null;
      if (fitKey !== App.State.lastFitKey) {
        App.State.lastFitKey = fitKey;
        if (fitKey) runFit(true);
      }
    }

    const vLine = document.createElement('div'); vLine.className = 'line-fixed-v'; vLine.style.left = C_.FIXED_CENTER_X + 'px'; inner.appendChild(vLine);
    const hLine = document.createElement('div'); hLine.className = 'line-fixed-h'; hLine.style.top = C_.FIXED_GROUND_Y + 'px'; inner.appendChild(hLine);

    // Фото — ПЕРЕД линиями разметки в DOM: линии/ползунки должны лежать поверх
    // фото и получать клики первыми, иначе крупное фото перехватывает указатель
    // и ползунки становятся недостижимы.
    const active = App.Data.activePhotoMeta(view);
    if (active) {
      const img = document.createElement('img'); img.className = 'canvas-photo' + (App.State.photoLocked ? ' locked' : '');
      const sub = active.kind === 'draft' ? 'draft' : '';
      App.Data.getPhotoFile(car.id, viewKey, sub, active.meta.file).then(f => {
        if (!f) return;
        img.src = URL.createObjectURL(f);
        createImageBitmap(f).then(bmp => {
          img.dataset.w = bmp.width; img.dataset.h = bmp.height;
          positionPhoto(img, active.meta, bmp.width, bmp.height);
        });
      });
      App.Drag(img, {
        scale: () => App.State.canvasZoom,
        onDrag: (dx, dy) => {
          if (App.State.photoLocked) return;
          const w = parseFloat(img.dataset.w) || img.naturalWidth, h = parseFloat(img.dataset.h) || img.naturalHeight;
          const nx = origX + dx, ny = origY + dy;
          active.meta.x = nx; active.meta.y = ny;
          positionPhoto(img, active.meta, w, h);
        },
        onEnd: () => { if (!App.State.photoLocked) App.Data.saveCar(car); },
      });
      var origX = active.meta.x, origY = active.meta.y;
      img.addEventListener('pointerdown', () => { origX = active.meta.x; origY = active.meta.y; });
      inner.appendChild(img);

      // Масштаб фото — отдельный от zoom холста. Ползунок + число (не тянуть за край
      // самого фото: при большом зуме край легко уезжает за экран).
      const scaleRow = document.createElement('div'); scaleRow.className = 'canvas-toolbar';
      const fitBtn = document.createElement('button'); fitBtn.textContent = 'Выровнять по высоте';
      fitBtn.title = 'Высота фото = ' + C_.CANVAS_HEIGHT + 'px — от верхней до нижней границы карточки';
      scaleRow.appendChild(fitBtn);
      const flipBtn = document.createElement('button'); flipBtn.textContent = '⇋ Флип по горизонтали';
      flipBtn.title = 'Перезаписывает сам файл фото зеркально (навсегда)';
      flipBtn.addEventListener('click', async () => {
        flipBtn.disabled = true;
        try { await App.Data.flipPhotoHorizontal(car, viewKey); renderAll(); }
        finally { flipBtn.disabled = false; }
      });
      scaleRow.appendChild(flipBtn);
      const scaleLbl = document.createElement('span'); scaleLbl.textContent = 'Масштаб фото:';
      scaleLbl.style.cssText = 'font-size:11px;color:#888;';
      scaleRow.appendChild(scaleLbl);
      const scaleRange = document.createElement('input'); scaleRange.type = 'range';
      scaleRange.min = '5'; scaleRange.max = '400'; scaleRange.step = '1'; scaleRange.value = Math.round(active.meta.scale * 100);
      scaleRange.style.width = '160px';
      scaleRow.appendChild(scaleRange);
      const scaleNum = document.createElement('input'); scaleNum.type = 'number';
      scaleNum.min = '5'; scaleNum.max = '400'; scaleNum.step = '1'; scaleNum.value = Math.round(active.meta.scale * 100);
      scaleNum.style.cssText = 'width:60px;font-size:11px;padding:4px 6px;border:1px solid #ddd;border-radius:5px;';
      scaleRow.appendChild(scaleNum);
      const scalePct = document.createElement('span'); scalePct.textContent = '%';
      scalePct.style.cssText = 'font-size:11px;color:#888;';
      scaleRow.appendChild(scalePct);

      function applyScale(pct, persist) {
        pct = Math.max(5, Math.min(400, pct));
        active.meta.scale = pct / 100;
        const w = parseFloat(img.dataset.w) || img.naturalWidth, h = parseFloat(img.dataset.h) || img.naturalHeight;
        positionPhoto(img, active.meta, w, h);
        scaleRange.value = pct; scaleNum.value = Math.round(pct);
        if (persist) App.Data.saveCar(car);
      }
      scaleRange.addEventListener('input', () => applyScale(parseFloat(scaleRange.value), false));
      scaleRange.addEventListener('change', () => applyScale(parseFloat(scaleRange.value), true));
      scaleNum.addEventListener('input', () => { const v = parseFloat(scaleNum.value); if (!isNaN(v)) applyScale(v, false); });
      scaleNum.addEventListener('change', () => { const v = parseFloat(scaleNum.value); if (!isNaN(v)) applyScale(v, true); });
      fitBtn.addEventListener('click', () => {
        const h = parseFloat(img.dataset.h) || img.naturalHeight;
        if (!h) return;
        // Без ограничения «не больше 100%» — жмём именно к высоте холста, апскейлит,
        // если фото меньше. applyScale сама подрежет к диапазону ползунка (5–300%).
        applyScale((C_.CANVAS_HEIGHT / h) * 100, true);
      });
      container.appendChild(scaleRow);
    } else {
      const empty = document.createElement('div'); empty.className = 'canvas-photo-empty'; empty.textContent = 'Добавьте драфт или финал фото ниже';
      inner.appendChild(empty);
    }

    // Границы ширины карточки (то, что реально попадёт в export.png) — после фото
    // в DOM, чтобы лежать поверх, а не прятаться за ним; не хендл, не двигается.
    const cw = car.cardWidth || 260;
    [C_.FIXED_CENTER_X - cw / 2, C_.FIXED_CENTER_X + cw / 2].forEach((bx, i) => {
      const bound = document.createElement('div'); bound.className = 'card-bound'; bound.style.left = bx + 'px';
      inner.appendChild(bound);
      const lbl = document.createElement('div'); lbl.className = 'card-bound-label';
      lbl.style.left = (bx + (i === 0 ? -46 : 4)) + 'px'; lbl.style.top = '2px';
      lbl.textContent = 'край карточки (' + cw + 'px)';
      lbl.style.transform = 'scale(' + (1 / App.State.canvasZoom) + ')';
      inner.appendChild(lbl);
    });

    if (isSide) {
      const showHandles = App.State.sideTab === 'proportions'; // на табе «Линейки» — только сами линии, без контролов

      // Общая отрисовка группы вертикальных линий (offsetX): «Вертикальные» и «Колёса»
      // используют один и тот же механизм, отличаются только набором ключей/цветами/
      // высотой подписи и тем, что radius рисуется пунктиром.
      function renderVerticalGroup(keys, dataObj, labels, colors, prefix, labelTop, dashedKeys) {
        keys.forEach(key => {
          const g = dataObj[key];
          if (!g.visible) return;
          const x = C_.FIXED_CENTER_X + g.offsetX;
          const dashed = dashedKeys && dashedKeys.has(key);
          const line = document.createElement('div');
          line.style.left = x + 'px';
          if (dashed) {
            line.className = 'guide-v-dashed';
            // Штрих 14px, промежуток 12px — крупно, чтобы не сливалось в сплошную при zoom холста.
            line.style.backgroundImage = 'repeating-linear-gradient(to bottom, ' + colors[key] + ' 0, ' + colors[key] + ' 14px, transparent 14px, transparent 26px)';
          } else {
            line.className = 'guide-v';
            line.style.borderColor = colors[key];
          }
          inner.appendChild(line);
          const label = document.createElement('div'); label.className = 'guide-label'; label.style.left = (x + 8) + 'px'; label.style.top = labelTop + 'px'; label.textContent = labels[key];
          label.style.transform = 'scale(' + (1 / App.State.canvasZoom) + ')';
          inner.appendChild(label);
          if (!showHandles) return;
          const handle = document.createElement('div'); handle.className = 'guide-handle-v'; handle.style.left = x + 'px'; handle.style.background = colors[key];
          // Компенсируем zoom холста, чтобы точка всегда была одного экранного размера
          // (её центр — точка отсчёта transform — уже совпадает с центром линии за счёт
          // отрицательных margin в CSS, так что позиция от масштабирования не съезжает).
          handle.style.transform = 'scale(' + (1 / App.State.canvasZoom) + ')';
          // baseX перечитывается на каждый pointerdown (а не один раз при рендере) —
          // иначе второй драг подряд считает смещение от устаревшей стартовой точки
          // и линия дёргается обратно.
          let baseX = x;
          handle.addEventListener('pointerdown', () => { baseX = C_.FIXED_CENTER_X + g.offsetX; });
          App.Drag(handle, {
            axis: 'x', scale: () => App.State.canvasZoom,
            onDrag: (dx) => { const nx = baseX + dx; handle.style.left = nx + 'px'; line.style.left = nx + 'px'; label.style.left = (nx + 8) + 'px'; g.offsetX = (nx - C_.FIXED_CENTER_X); updateLegendVal(prefix + key, g.offsetX); },
            onEnd: () => App.Data.saveCar(car),
          });
          inner.appendChild(handle);
        });
      }
      renderVerticalGroup(C_.VERTICAL_LINES, view.guides.vertical, C_.VERTICAL_LABELS, C_.VERTICAL_COLORS, 'v-', 2);
      const wheels = view.guides.wheels || (view.guides.wheels = (() => { const w = {}; C_.WHEEL_LINES.forEach(k => w[k] = { offsetX: C_.WHEEL_DEFAULTS[k], visible: true }); return w; })());
      renderVerticalGroup(C_.WHEEL_LINES, wheels, C_.WHEEL_LABELS, C_.WHEEL_COLORS, 'w-', 18, new Set(C_.WHEEL_LINES));

      C_.HORIZONTAL_LINES.forEach(key => {
        const g = view.guides.horizontal[key];
        if (!g.visible) return;
        const y = C_.FIXED_GROUND_Y + g.offsetY;
        const line = document.createElement('div'); line.className = 'guide-h'; line.style.top = y + 'px'; line.style.borderColor = C_.HORIZONTAL_COLORS[key];
        inner.appendChild(line);
        const label = document.createElement('div'); label.className = 'guide-label'; label.style.left = (C_.FIXED_CENTER_X + 12) + 'px'; label.style.top = (y - 15) + 'px'; label.textContent = C_.HORIZONTAL_LABELS[key];
        label.style.transform = 'scale(' + (1 / App.State.canvasZoom) + ')';
        inner.appendChild(label);
        if (!showHandles) return;
        const handle = document.createElement('div'); handle.className = 'guide-handle-h'; handle.style.top = y + 'px'; handle.style.left = C_.FIXED_CENTER_X + 'px'; handle.style.background = C_.HORIZONTAL_COLORS[key];
        handle.style.transform = 'scale(' + (1 / App.State.canvasZoom) + ')';
        let baseY = y;
        handle.addEventListener('pointerdown', () => { baseY = C_.FIXED_GROUND_Y + g.offsetY; });
        App.Drag(handle, {
          axis: 'y', scale: () => App.State.canvasZoom,
          onDrag: (dx, dy) => { const ny = baseY + dy; handle.style.top = ny + 'px'; line.style.top = ny + 'px'; label.style.top = (ny - 15) + 'px'; g.offsetY = (ny - C_.FIXED_GROUND_Y); updateLegendVal('h-' + key, g.offsetY); },
          onEnd: () => App.Data.saveCar(car),
        });
        inner.appendChild(handle);
      });

      // Пропорциональная линейка — только на своём табе. Полоска красный/белый на
      // границе выбранного соотношения + 3 линии (два конца тянутся, средняя вычисляется).
      // ratioByKey — доля МЕНЬШЕЙ части; без инверсии первой идёт бОльшая (1 - ratio).
      function rulerSplitFrac(r) {
        const v = C_.RATIOS[r.ratioKey || 'gold'] ?? C_.RATIOS.gold;
        return r.invert ? v : (1 - v);
      }
      if (App.State.sideTab === 'rulers') {
        const rulers = view.guides.rulers || (view.guides.rulers = App.Data.defaultRulers());

        if (rulers.horizontal.enabled) {
          const r = rulers.horizontal;
          const stripY = C_.CANVAS_HEIGHT - 20, stripH = 14;
          const redRect = document.createElement('div'); redRect.className = 'ruler-strip ruler-strip-red';
          const whiteRect = document.createElement('div'); whiteRect.className = 'ruler-strip ruler-strip-white';
          const lStart = document.createElement('div'); lStart.className = 'ruler-gline-v';
          const lRatio = document.createElement('div'); lRatio.className = 'ruler-gline-v';
          const lEnd = document.createElement('div'); lEnd.className = 'ruler-gline-v';
          [redRect, whiteRect, lStart, lRatio, lEnd].forEach(el => inner.appendChild(el));
          [lStart, lRatio, lEnd].forEach(l => { l.style.top = '0px'; l.style.height = (stripY + stripH) + 'px'; });
          redRect.style.top = stripY + 'px'; redRect.style.height = stripH + 'px';
          whiteRect.style.top = stripY + 'px'; whiteRect.style.height = stripH + 'px';

          function layoutH() {
            const startX = C_.FIXED_CENTER_X + r.startOffsetX, endX = C_.FIXED_CENTER_X + r.endOffsetX;
            const ratioX = startX + (endX - startX) * rulerSplitFrac(r);
            lStart.style.left = startX + 'px'; lRatio.style.left = ratioX + 'px'; lEnd.style.left = endX + 'px';
            redRect.style.left = Math.min(startX, ratioX) + 'px'; redRect.style.width = Math.abs(ratioX - startX) + 'px';
            whiteRect.style.left = Math.min(ratioX, endX) + 'px'; whiteRect.style.width = Math.abs(endX - ratioX) + 'px';
          }
          layoutH();

          [['startOffsetX'], ['endOffsetX']].forEach(([key]) => {
            const handle = document.createElement('div'); handle.className = 'ruler-handle-v';
            handle.style.transform = 'scale(' + (1 / App.State.canvasZoom) + ')';
            handle.style.left = (C_.FIXED_CENTER_X + r[key]) + 'px';
            let base = r[key];
            handle.addEventListener('pointerdown', () => { base = r[key]; });
            App.Drag(handle, {
              axis: 'x', scale: () => App.State.canvasZoom,
              onDrag: dx => { r[key] = base + dx; handle.style.left = (C_.FIXED_CENTER_X + r[key]) + 'px'; layoutH(); },
              onEnd: () => App.Data.saveCar(car),
            });
            inner.appendChild(handle);
          });
        }

        if (rulers.vertical.enabled) {
          const r = rulers.vertical;
          const stripX = (C_.FIXED_CENTER_X - cw / 2) - 30, stripW = 14;
          const redRect = document.createElement('div'); redRect.className = 'ruler-strip ruler-strip-red';
          const whiteRect = document.createElement('div'); whiteRect.className = 'ruler-strip ruler-strip-white';
          const lStart = document.createElement('div'); lStart.className = 'ruler-gline-h';
          const lRatio = document.createElement('div'); lRatio.className = 'ruler-gline-h';
          const lEnd = document.createElement('div'); lEnd.className = 'ruler-gline-h';
          [redRect, whiteRect, lStart, lRatio, lEnd].forEach(el => inner.appendChild(el));
          [lStart, lRatio, lEnd].forEach(l => { l.style.left = '0px'; l.style.right = '0px'; });
          redRect.style.left = stripX + 'px'; redRect.style.width = stripW + 'px';
          whiteRect.style.left = stripX + 'px'; whiteRect.style.width = stripW + 'px';

          function layoutV() {
            const startY = C_.FIXED_GROUND_Y + r.startOffsetY, endY = C_.FIXED_GROUND_Y + r.endOffsetY;
            const ratioY = startY + (endY - startY) * rulerSplitFrac(r);
            lStart.style.top = startY + 'px'; lRatio.style.top = ratioY + 'px'; lEnd.style.top = endY + 'px';
            redRect.style.top = Math.min(startY, ratioY) + 'px'; redRect.style.height = Math.abs(ratioY - startY) + 'px';
            whiteRect.style.top = Math.min(ratioY, endY) + 'px'; whiteRect.style.height = Math.abs(endY - ratioY) + 'px';
          }
          layoutV();

          [['startOffsetY'], ['endOffsetY']].forEach(([key]) => {
            const handle = document.createElement('div'); handle.className = 'ruler-handle-h';
            handle.style.transform = 'scale(' + (1 / App.State.canvasZoom) + ')';
            handle.style.left = stripX + 'px';
            handle.style.top = (C_.FIXED_GROUND_Y + r[key]) + 'px';
            let base = r[key];
            handle.addEventListener('pointerdown', () => { base = r[key]; });
            App.Drag(handle, {
              axis: 'y', scale: () => App.State.canvasZoom,
              onDrag: (dx, dy) => { r[key] = base + dy; handle.style.top = (C_.FIXED_GROUND_Y + r[key]) + 'px'; layoutV(); },
              onEnd: () => App.Data.saveCar(car),
            });
            inner.appendChild(handle);
          });
        }
      }
    }

    if (App.State.showOverlay && view.lastExport) {
      const ov = document.createElement('img'); ov.className = 'canvas-overlay-final';
      App.Data.getPhotoFile(car.id, viewKey, '', 'export.png').then(f => { if (f) ov.src = URL.createObjectURL(f); });
      ov.style.left = (C_.FIXED_CENTER_X - view.lastExport.width / 2) + 'px';
      ov.style.top = '0px';
      ov.style.width = view.lastExport.width + 'px';
      ov.style.height = C_.CANVAS_HEIGHT + 'px';
      inner.appendChild(ov);
    }

    scroll.appendChild(inner);
    area.appendChild(scroll);

    let legend = null;
    if (isSide) {
      legend = document.createElement('div'); legend.className = 'guide-legend';

      const tabsRow = document.createElement('div'); tabsRow.className = 'side-panel-tabs';
      [['proportions', 'Пропорции'], ['rulers', 'Линейки'], ['metrics', 'Метрики']].forEach(([key, label]) => {
        const btn = document.createElement('button'); btn.className = 'side-tab' + (App.State.sideTab === key ? ' active' : '');
        btn.textContent = label;
        btn.addEventListener('click', () => { if (App.State.sideTab !== key) { App.State.sideTab = key; renderAll(); } });
        tabsRow.appendChild(btn);
      });
      legend.appendChild(tabsRow);

      if (App.State.sideTab === 'proportions') {
        const vTitle = document.createElement('div'); vTitle.className = 'legend-group-title'; vTitle.textContent = 'Вертикальные';
        legend.appendChild(vTitle);
        C_.VERTICAL_LINES.forEach(key => legend.appendChild(legendRow('v-' + key, C_.VERTICAL_LABELS[key], C_.VERTICAL_COLORS[key], view.guides.vertical[key], 'offsetX', car, view)));
        const hTitle = document.createElement('div'); hTitle.className = 'legend-group-title'; hTitle.textContent = 'Горизонтальные';
        legend.appendChild(hTitle);
        C_.HORIZONTAL_LINES.forEach(key => legend.appendChild(legendRow('h-' + key, C_.HORIZONTAL_LABELS[key], C_.HORIZONTAL_COLORS[key], view.guides.horizontal[key], 'offsetY', car, view)));
        const wTitle = document.createElement('div'); wTitle.className = 'legend-group-title'; wTitle.textContent = 'Колёса';
        legend.appendChild(wTitle);
        C_.WHEEL_LINES.forEach(key => legend.appendChild(legendRow('w-' + key, C_.WHEEL_LABELS[key], C_.WHEEL_COLORS[key], view.guides.wheels[key], 'offsetX', car, view)));
        const saveDefBtn = document.createElement('button');
        saveDefBtn.textContent = 'Карточка по умолчанию';
        saveDefBtn.title = 'Разметка, ширина карточки (' + (car.cardWidth || 260) + 'px), стиль (' + (car.style || '—') + ') и подстиль (' + (car.substyle || '—') + ') станут стартовыми для всех НОВЫХ машин';
        saveDefBtn.style.cssText = 'margin-top:12px;width:100%;font-size:10.5px;padding:6px 8px;border-radius:6px;border:1px dashed #ccc;background:#fff;color:#888;cursor:pointer;';
        const saveDefBtnLabel = saveDefBtn.textContent;
        saveDefBtn.addEventListener('click', async () => {
          await App.Data.saveCardDefaults(view.guides, car.cardWidth, car.style, car.substyle);
          saveDefBtn.textContent = '✓ Сохранено';
          saveDefBtn.style.color = '#2e7d32';
          saveDefBtn.style.borderColor = '#2e7d32';
          clearTimeout(saveDefBtn._resetTimer);
          saveDefBtn._resetTimer = setTimeout(() => {
            saveDefBtn.textContent = saveDefBtnLabel;
            saveDefBtn.style.color = '#888';
            saveDefBtn.style.borderColor = '#ccc';
          }, 1500);
        });
        legend.appendChild(saveDefBtn);
      } else if (App.State.sideTab === 'rulers') {
        const rulers = view.guides.rulers || (view.guides.rulers = App.Data.defaultRulers());
        const rTitle = document.createElement('div'); rTitle.className = 'legend-group-title'; rTitle.textContent = 'Пропорциональная линейка';
        legend.appendChild(rTitle);

        function rulerControls(label, r, resetLabel, resetFn) {
          const wrap = document.createElement('div'); wrap.style.marginBottom = '10px';
          const rowMain = document.createElement('label'); rowMain.className = 'ruler-row';
          const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = r.enabled;
          chk.onchange = () => { r.enabled = chk.checked; App.Data.saveCar(car); renderAll(); };
          rowMain.appendChild(chk); rowMain.appendChild(document.createTextNode(label));
          wrap.appendChild(rowMain);

          const rowRatio = document.createElement('div'); rowRatio.className = 'ruler-row';
          const sel = document.createElement('select');
          C_.RATIO_ORDER.forEach(k => {
            const opt = document.createElement('option'); opt.value = k; opt.textContent = C_.RATIO_LABELS[k];
            if ((r.ratioKey || 'gold') === k) opt.selected = true;
            sel.appendChild(opt);
          });
          sel.onchange = () => { r.ratioKey = sel.value; App.Data.saveCar(car); renderAll(); };
          rowRatio.appendChild(sel);
          wrap.appendChild(rowRatio);

          const rowInv = document.createElement('label'); rowInv.className = 'ruler-row';
          const chkInv = document.createElement('input'); chkInv.type = 'checkbox'; chkInv.checked = !!r.invert;
          chkInv.onchange = () => { r.invert = chkInv.checked; App.Data.saveCar(car); renderAll(); };
          rowInv.appendChild(chkInv); rowInv.appendChild(document.createTextNode('инверсия (сначала меньшая часть)'));
          wrap.appendChild(rowInv);

          const resetBtn = document.createElement('button'); resetBtn.textContent = resetLabel;
          resetBtn.style.cssText = 'width:100%;font-size:10.5px;padding:5px 6px;border-radius:6px;border:1px solid #ccc;background:#fff;color:#666;cursor:pointer;margin-top:2px;';
          resetBtn.addEventListener('click', () => { resetFn(); App.Data.saveCar(car); renderAll(); });
          wrap.appendChild(resetBtn);

          return wrap;
        }
        legend.appendChild(rulerControls('Горизонтальная', rulers.horizontal, 'Концы = Head / Trunk', () => {
          rulers.horizontal.startOffsetX = view.guides.vertical.head.offsetX;
          rulers.horizontal.endOffsetX = view.guides.vertical.trunk.offsetX;
        }));
        legend.appendChild(rulerControls('Вертикальная', rulers.vertical, 'Концы = Bottom / Top', () => {
          rulers.vertical.startOffsetY = view.guides.horizontal.bottom.offsetY;
          rulers.vertical.endOffsetY = view.guides.horizontal.top.offsetY;
        }));

        const hint = document.createElement('div');
        hint.textContent = 'Концы (по умолчанию head/trunk и top/ground) — тянуть за красную точку. Средняя точка вычисляется по выбранному соотношению, не двигается.';
        hint.style.cssText = 'font-size:10px;color:#999;margin-top:4px;line-height:1.4;';
        legend.appendChild(hint);
      } else if (App.State.sideTab === 'metrics') {
        legend.appendChild(renderMetricsPanel(car));
      }
    }

    container.appendChild(area);
    // Пропорции/линейки — под холстом, не сбоку: холст занимает всю доступную ширину.
    if (legend) container.appendChild(legend);
    // Только теперь холст реально в DOM и имеет ширину — до этого clientWidth был 0
    // и центрирование скролла считалось неверно. scrollLeft у скролл-контейнера — в
    // экранных пикселях, а FIXED_CENTER_X — в логических пикселях .canvas-inner,
    // поэтому переводим через текущий zoom.
    scroll.scrollLeft = C_.FIXED_CENTER_X * App.State.canvasZoom - scroll.clientWidth / 2;
  }

  function positionPhoto(img, meta, w, h) {
    const C_ = App.Const;
    const dw = w * meta.scale, dh = h * meta.scale;
    img.style.width = dw + 'px'; img.style.height = dh + 'px';
    img.style.left = (C_.FIXED_CENTER_X + meta.x - dw / 2) + 'px';
    img.style.top = (C_.FIXED_GROUND_Y + meta.y - dh) + 'px';
  }

  function legendRow(id, label, color, g, offsetKey, car, view) {
    const row = document.createElement('div'); row.className = 'legend-row';
    const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = g.visible;
    chk.onchange = () => { g.visible = chk.checked; App.Data.saveCar(car); renderAll(); };
    row.appendChild(chk);
    const dot = document.createElement('span'); dot.className = 'legend-dot'; dot.style.background = color; row.appendChild(dot);
    const name = document.createElement('span'); name.className = 'legend-name'; name.textContent = label; row.appendChild(name);
    // Поле ввода вместо просто текста — можно вбить точное число руками, не только
    // тащить хендл на холсте. updateLegendVal (вызывается из драга на холсте) пишет
    // сюда же во время перетаскивания, чтобы значения были синхронны в обе стороны.
    const val = document.createElement('input'); val.type = 'number'; val.className = 'legend-val'; val.id = 'legend-val-' + id;
    val.value = Math.round(g[offsetKey]);
    val.addEventListener('change', () => {
      const v = parseFloat(val.value);
      if (isNaN(v)) { val.value = Math.round(g[offsetKey]); return; }
      g[offsetKey] = v;
      App.Data.saveCar(car);
      renderAll();
    });
    row.appendChild(val);
    return row;
  }
  function updateLegendVal(id, val) {
    const el = document.getElementById('legend-val-' + id);
    if (el) el.value = Math.round(val);
  }

  // Таблица «Среднее по подстилю / Эта машина / Отклонение» — считается на лету из
  // App.State.cars при каждом рендере, отдельно нигде не хранится и не может протухнуть:
  // поменял разметку любой машины подстиля, добавил/убрал машину из подстиля — открыл
  // (или просто пересчитал через renderAll) карточку и цифры уже новые.
  function fmtMetricValue(key, value) {
    if (value === null || value === undefined || isNaN(value)) return '—';
    return App.Data.METRIC_IS_RATIO[key] ? value.toFixed(2) : (value * 100).toFixed(1) + '%';
  }
  function fmtMetricDelta(key, value) {
    if (value === null || value === undefined || isNaN(value)) return '—';
    const sign = value > 0 ? '+' : (value < 0 ? '' : '±');
    return App.Data.METRIC_IS_RATIO[key] ? sign + value.toFixed(2) : sign + (value * 100).toFixed(1) + 'pp';
  }
  function renderMetricsPanel(car) {
    const wrap = document.createElement('div');
    const title = document.createElement('div'); title.className = 'legend-group-title';
    title.textContent = 'Метрики (сбоку)';
    wrap.appendChild(title);

    const own = App.Data.carMetrics(car);
    if (!own) {
      const msg = document.createElement('div'); msg.style.cssText = 'font-size:11px;color:#999;';
      msg.textContent = 'Нет разметки колёс/линий — метрики не считаются.';
      wrap.appendChild(msg);
      return wrap;
    }

    const group = App.Data.substyleGroupMetrics(car);
    const statusLine = document.createElement('div');
    statusLine.style.cssText = 'font-size:10.5px;color:#999;margin-bottom:8px;';
    if (!car.substyle) statusLine.textContent = 'Нет подстиля — сравнивать не с чем, показаны только значения машины.';
    else if (!group || group.count <= 1) statusLine.textContent = 'Подстиль «' + car.substyle + '»: только эта машина — отклонение будет нулевым.';
    else statusLine.textContent = 'Подстиль «' + car.substyle + '»: ' + group.count + ' машин(ы) в группе.';
    wrap.appendChild(statusLine);

    const table = document.createElement('table'); table.className = 'metrics-table';
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th></th><th>Среднее</th><th>Машина</th><th>Откл.</th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    App.Data.METRIC_ORDER.forEach(key => {
      const avg = group ? group.averages[key] : null;
      const val = own[key];
      const delta = (avg !== null && avg !== undefined && val !== null && val !== undefined) ? val - avg : null;
      // ">5пп" — только для долей (проценты); у lengthHeight своя шкала (отношение,
      // не проценты), "пп" к нему не применимо, поэтому не подсвечиваем.
      const isHigh = !App.Data.METRIC_IS_RATIO[key] && delta !== null && Math.abs(delta * 100) > 5;
      const tr = document.createElement('tr');
      tr.innerHTML = '<td class="metrics-label">' + App.esc(App.Data.METRIC_LABELS[key]) + '</td>' +
        '<td class="metrics-num">' + fmtMetricValue(key, avg) + '</td>' +
        '<td class="metrics-num">' + fmtMetricValue(key, val) + '</td>' +
        '<td class="metrics-num metrics-delta' + (isHigh ? ' metrics-delta-high' : '') + '">' + fmtMetricDelta(key, delta) + '</td>';
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);

    if (group && group.count > 1) {
      const list = document.createElement('div');
      list.style.cssText = 'font-size:10px;color:#aaa;margin-top:6px;line-height:1.5;';
      list.textContent = 'В группе: ' + group.groupCars.map(c => c.name.trim()).join(', ');
      wrap.appendChild(list);
    }
    return wrap;
  }

  function renderCarContent() {
    const car = activeCar();
    const content = document.getElementById('car-content');
    const empty = document.getElementById('empty-state');
    if (!car) { content.style.display = 'none'; empty.style.display = 'block'; empty.textContent = App.State.cars.length ? 'Выберите карточку слева.' : 'Нажмите «+ Создать карточку», чтобы начать.'; return; }
    empty.style.display = 'none'; content.style.display = 'block';
    content.innerHTML = '';
    renderCarForm(car, content);
    renderViewTabs(car, content);
    renderPhotoCols(car, App.State.activeView, content);
    renderCanvas(car, App.State.activeView, content);
  }

  function renderAll() {
    const hasFolder = !!App.State.rootHandle;
    document.getElementById('empty-state').style.display = hasFolder ? 'none' : 'block';
    document.getElementById('car-list-panel').style.display = hasFolder ? 'flex' : 'none';
    if (!hasFolder) { document.getElementById('empty-state').textContent = 'Откройте (или создайте) папку data, чтобы начать.'; return; }
    renderCarList();
    renderCarContent();
  }

  return { renderAll, activeCar };
})();

