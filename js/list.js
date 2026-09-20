// list.js — トップ（カレンダー兼一覧）画面の描画
(function () {
  const { loadData, occurrences, genreCategory, sourceInfo, scaleImageUrl, todayStr, formatDateRange } = window.MatsuriData;
  const { mergeBlockedDates, getVisitedRecord } = window.MatsuriStorage;
  const { defaultState, monthsAvailable, applyFilters, renderMonthTabs, renderFilterPanel, updateFilterChipStates } = window.MatsuriFilter;

  function getAreaLabel(ev) {
    const addr = ev.venue && ev.venue.address;
    if (addr) {
      const m = addr.match(/(?:.{2,3}[都道府県])(.+?[市区町村])/);
      if (m) return m[1];
    }
    return (ev.venue && ev.venue.name) || '';
  }

  const ACCESS_ICON = { car: '車', train: '電車', either: '車・電車' };

  function accessSummary(ev) {
    const a = ev.access || {};
    const mode = a.recommend || 'car';
    if (mode === 'car' && a.car) return `車 約${a.car.minutes ?? '?'}分`;
    if (mode === 'train' && a.train) return `電車 約${a.train.minutes ?? '?'}分`;
    if (a.car && a.train) return `車${a.car.minutes ?? '?'}分・電車${a.train.minutes ?? '?'}分`;
    if (a.car) return `車 約${a.car.minutes ?? '?'}分`;
    if (a.train) return `電車 約${a.train.minutes ?? '?'}分`;
    return ACCESS_ICON[mode] || '';
  }

  function findBlock(blockedDates, dateObj) {
    return blockedDates.find(b => b.date >= dateObj.start && b.date <= dateObj.end);
  }

  function pastVisitLabel(visitedRecord, dateObj) {
    if (!visitedRecord || visitedRecord.date >= dateObj.start) return '';
    const diff = parseInt(dateObj.start.slice(0, 4), 10) - parseInt(visitedRecord.date.slice(0, 4), 10);
    if (diff <= 0) return '';
    return diff === 1 ? '去年行った' : `${diff}年前に行った`;
  }

  function eventCardHtml(ev, dateObj, dateIndex, blockedDates) {
    const cat = genreCategory(ev);
    const src = sourceInfo(ev);
    const rank = (ev.scale && ev.scale.sizeRank) || 'S';
    const scaleImg = scaleImageUrl(rank);
    const block = findBlock(blockedDates, dateObj);
    const visitedRecord = getVisitedRecord(ev.id);
    const isThisDateVisited = !!visitedRecord && visitedRecord.date === dateObj.start;
    const pastLabel = pastVisitLabel(visitedRecord, dateObj);
    const dateLabel = dateObj.label ? ` <span class="date-tag">${dateObj.label}</span>` : '';
    const timeLabel = dateObj.timeStart ? `${dateObj.timeStart}${dateObj.timeEnd ? '〜' + dateObj.timeEnd : '〜'}` : '';

    return `
      <a class="event-card cat-${cat.key}${block ? ' is-blocked' : ''}" href="event.html?id=${encodeURIComponent(ev.id)}&d=${dateIndex}">
        <div class="event-card-main">
          <div class="event-card-name"><span class="source-badge source-${src.key}">${src.icon} ${src.label}</span> ${window.MatsuriAccess.escapeHtml(ev.name)}${dateLabel}${pastLabel ? ` <span class="date-tag">${window.MatsuriAccess.escapeHtml(pastLabel)}</span>` : ''}</div>
          <div class="event-card-meta">
            <span class="area">${window.MatsuriAccess.escapeHtml(getAreaLabel(ev))}</span>
            <span class="dot">・</span>
            <span class="scale scale-${(ev.scale && ev.scale.sizeRank) || 'S'}">${(ev.scale && ev.scale.sizeRank) || '?'}</span>
            <span class="dot">・</span>
            <span class="access">${accessSummary(ev)}</span>
            <span class="dot">・</span>
            <span class="stalls">出店${(ev.stalls && ev.stalls.level) || '未調査'}</span>
          </div>
          ${timeLabel ? `<div class="event-card-time">${timeLabel}</div>` : ''}
        </div>
        ${scaleImg ? `<img class="event-card-thumb" src="${scaleImg}" alt="規模ランク${rank}のイメージ" loading="lazy">` : ''}
        ${block ? `<div class="ng-badge">${window.MatsuriAccess.escapeHtml(block.label || 'NG日')}</div>` : ''}
        ${!block && isThisDateVisited ? `<div class="visited-badge">✓ 行った</div>` : ''}
      </a>
    `;
  }

  function groupByDate(rows) {
    const groups = [];
    let current = null;
    for (const row of rows) {
      if (!current || current.key !== row.sortKey) {
        current = { key: row.sortKey, rows: [] };
        groups.push(current);
      }
      current.rows.push(row);
    }
    return groups;
  }

  function renderCards(container, rows, blockedDates) {
    const groups = groupByDate(rows);
    if (groups.length === 0) {
      container.innerHTML = '<p class="empty">条件に合うイベントがありません。絞り込みを見直してください。</p>';
      return;
    }
    container.innerHTML = groups.map(g => {
      const first = g.rows[0];
      const dateHeader = formatDateRange(first.date);
      const countNote = g.rows.length > 1 ? `<span class="group-count">この日は他に${g.rows.length - 1}件</span>` : '';
      const cards = g.rows.map(r => eventCardHtml(r.event, r.date, r.dateIndex, blockedDates)).join('');
      return `
        <section class="date-group">
          <h2 class="date-group-header">${dateHeader}${countNote}</h2>
          <div class="date-group-cards">${cards}</div>
        </section>
      `;
    }).join('');
  }

  async function render() {
    const main = document.getElementById('main');
    main.innerHTML = '<p class="loading">読み込み中…</p>';
    const data = await loadData();
    const blockedDates = mergeBlockedDates(data.blockedDatesInitial);
    const today = todayStr();
    const allRows = occurrences(data).filter(r => r.date.end >= today);
    const months = monthsAvailable(allRows);
    const state = defaultState();

    main.innerHTML = `
      <div id="month-tabs" class="month-tabs"></div>
      <div id="filter-panel-container"></div>
      <div id="cards-container"></div>
    `;
    const monthTabsEl = document.getElementById('month-tabs');
    const filterPanelEl = document.getElementById('filter-panel-container');
    const cardsEl = document.getElementById('cards-container');

    function update() {
      renderMonthTabs(monthTabsEl, months, state, update);
      updateFilterChipStates(filterPanelEl, state);
      const filtered = applyFilters(allRows, state, blockedDates);
      renderCards(cardsEl, filtered, blockedDates);
    }

    renderFilterPanel(filterPanelEl, state, update);
    update();
  }

  document.addEventListener('DOMContentLoaded', render);
})();
