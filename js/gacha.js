// gacha.js — 迷ったら1件提案する抽選画面
(function () {
  const { loadData, occurrences, genreCategory, sourceInfo, isShrineEvent, todayStr, formatDateRange } = window.MatsuriData;
  const { mergeBlockedDates } = window.MatsuriStorage;
  const { renderAccessBlock, escapeHtml } = window.MatsuriAccess;

  const state = {
    when: 'any',       // 'weekend' | 'nextMonth' | 'any'
    access: 'all',      // 'all' | 'car' | 'train'
    kidPriority: false,
    includeShrine: false,
  };

  let data = null;
  let blockedDates = [];
  let currentList = [];
  let currentRow = null;

  function fmt(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function weekendRange(today) {
    const d = new Date(today + 'T00:00:00');
    const dow = d.getDay();
    if (dow === 0) return { start: today, end: today };
    const daysUntilSat = (6 - dow + 7) % 7;
    const sat = new Date(d); sat.setDate(sat.getDate() + daysUntilSat);
    const sun = new Date(sat); sun.setDate(sun.getDate() + 1);
    return { start: fmt(sat), end: fmt(sun) };
  }

  function nextMonthRange(today) {
    const d = new Date(today + 'T00:00:00');
    const y = d.getFullYear(), m = d.getMonth();
    const start = new Date(y, m + 1, 1);
    const end = new Date(y, m + 2, 0);
    return { start: fmt(start), end: fmt(end) };
  }

  function overlaps(dateObj, range) {
    return dateObj.start <= range.end && dateObj.end >= range.start;
  }

  function isBlockedRow(row) {
    return blockedDates.some(b => b.date >= row.date.start && b.date <= row.date.end);
  }

  function matchesAccess(ev, mode) {
    if (mode === 'all') return true;
    const a = ev.access || {};
    if (mode === 'car') return !!a.car;
    if (mode === 'train') return !a.car && !!a.train;
    return true;
  }

  function candidates(overrides) {
    const s = { ...state, ...overrides };
    const today = todayStr();
    let rows = occurrences(data).filter(r => r.date.end >= today);
    rows = rows.filter(r => r.event.status !== 'tentative');
    if (!s.includeShrine) rows = rows.filter(r => !isShrineEvent(r.event));
    rows = rows.filter(r => !isBlockedRow(r));
    if (s.when === 'weekend') {
      const range = weekendRange(today);
      rows = rows.filter(r => overlaps(r.date, range));
    } else if (s.when === 'nextMonth') {
      const range = nextMonthRange(today);
      rows = rows.filter(r => overlaps(r.date, range));
    }
    rows = rows.filter(r => matchesAccess(r.event, s.access));
    if (s.kidPriority) {
      rows = rows.filter(r => (r.event.audience && r.event.audience.kidScore) >= 3);
    }
    return rows;
  }

  function buildSuggestions() {
    const suggestions = [];
    if (state.when !== 'any') {
      const count = candidates({ when: 'any' }).length;
      if (count > 0) suggestions.push({ label: '「いつ行く？」の条件', count });
    }
    if (state.access !== 'all') {
      const count = candidates({ access: 'all' }).length;
      if (count > 0) suggestions.push({ label: '移動手段の条件', count });
    }
    if (state.kidPriority) {
      const count = candidates({ kidPriority: false }).length;
      if (count > 0) suggestions.push({ label: '子連れ優先の条件', count });
    }
    if (!state.includeShrine) {
      const count = candidates({ includeShrine: true }).length;
      if (count > 0) suggestions.push({ label: '神社行事を含めない条件', count });
    }
    return suggestions.sort((a, b) => b.count - a.count);
  }

  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function chip(value, label, isActive, dataAttr) {
    return `<button type="button" class="chip${isActive ? ' is-active' : ''}" data-${dataAttr}="${value}">${label}</button>`;
  }

  function renderCondition() {
    const main = document.getElementById('main');
    main.innerHTML = `
      <section class="card-step">
        <h2>条件を選ぶ</h2>
        <div class="frow">
          <span class="frow-label">いつ行く？</span>
          <div class="chip-row" id="g-when">
            ${chip('weekend', '今週末', state.when === 'weekend', 'when')}
            ${chip('nextMonth', '来月', state.when === 'nextMonth', 'when')}
            ${chip('any', 'いつでも', state.when === 'any', 'when')}
          </div>
        </div>
        <div class="frow">
          <span class="frow-label">移動手段</span>
          <div class="chip-row" id="g-access">
            ${chip('all', '指定なし', state.access === 'all', 'access')}
            ${chip('car', '車で行ける', state.access === 'car', 'access')}
            ${chip('train', '電車のみ', state.access === 'train', 'access')}
          </div>
        </div>
        <div class="frow">
          <label class="ng-exclude-toggle"><input type="checkbox" id="g-kid" ${state.kidPriority ? 'checked' : ''}> 子連れ優先（子連れ向き度★3以上）</label>
        </div>
        <div class="frow">
          <label class="ng-exclude-toggle"><input type="checkbox" id="g-shrine" ${state.includeShrine ? 'checked' : ''}> 神社行事・縁起ものも含める</label>
        </div>
        <div class="btn-row">
          <button type="button" class="btn-gacha" id="gacha-spin-btn">ガチャを回す</button>
        </div>
      </section>
    `;

    main.querySelectorAll('#g-when .chip').forEach(b => {
      b.addEventListener('click', () => { state.when = b.dataset.when; renderCondition(); });
    });
    main.querySelectorAll('#g-access .chip').forEach(b => {
      b.addEventListener('click', () => { state.access = b.dataset.access; renderCondition(); });
    });
    document.getElementById('g-kid').addEventListener('change', e => { state.kidPriority = e.target.checked; });
    document.getElementById('g-shrine').addEventListener('change', e => { state.includeShrine = e.target.checked; });
    document.getElementById('gacha-spin-btn').addEventListener('click', spin);
  }

  function spin() {
    currentList = candidates();
    if (currentList.length === 0) {
      renderEmpty();
      return;
    }
    currentRow = pickRandom(currentList);
    playSpinThenShow();
  }

  function reroll() {
    if (currentList.length === 0) return;
    currentRow = pickRandom(currentList);
    playSpinThenShow();
  }

  function playSpinThenShow() {
    const main = document.getElementById('main');
    main.innerHTML = `
      <section class="card-step spin-view">
        <div class="spin-icon" aria-hidden="true">🏮</div>
        <p>ガチャを回しています…</p>
      </section>
    `;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(renderResult, reduced ? 0 : 900);
  }

  function overviewLine(ev) {
    const genreText = (ev.genre || []).join('・');
    const venueName = (ev.venue && ev.venue.name) || '';
    return `${genreText}のイベント。会場は${venueName}。`;
  }

  function renderResult() {
    const main = document.getElementById('main');
    const ev = currentRow.event;
    const dateObj = currentRow.date;
    const cat = genreCategory(ev);
    const src = sourceInfo(ev);
    const stars = '★'.repeat((ev.audience && ev.audience.kidScore) || 0) + '☆'.repeat(5 - ((ev.audience && ev.audience.kidScore) || 0));

    main.innerHTML = `
      <section class="card-step result-view">
        <article class="gacha-result cat-${cat.key}">
          <span class="source-badge source-${src.key}">${src.icon} ${src.label}</span>
          <div class="gacha-result-date">${formatDateRange(dateObj)}${dateObj.timeStart ? `　${dateObj.timeStart}〜${dateObj.timeEnd || ''}` : ''}</div>
          <h2 class="gacha-result-name">${escapeHtml(ev.name)}</h2>
          <p class="gacha-result-summary">${escapeHtml(overviewLine(ev))}</p>
          <div class="gacha-result-meta">
            <span class="scale scale-${(ev.scale && ev.scale.sizeRank) || 'S'}">規模${(ev.scale && ev.scale.sizeRank) || '?'}</span>
            <span class="dot">・</span>
            <span>出店${(ev.stalls && ev.stalls.level) || '未調査'}</span>
            <span class="dot">・</span>
            <span class="kid-score">${stars}</span>
          </div>
          ${renderAccessBlock(ev)}
          <a class="btn-detail" href="event.html?id=${encodeURIComponent(ev.id)}&d=${currentRow.dateIndex}">詳細を見る</a>
        </article>
        <div class="btn-row">
          <button type="button" class="btn-ghost" id="g-change">条件を変える</button>
          <button type="button" class="btn-gacha" id="g-reroll">引き直す</button>
        </div>
      </section>
    `;

    document.getElementById('g-change').addEventListener('click', renderCondition);
    document.getElementById('g-reroll').addEventListener('click', reroll);
  }

  function renderEmpty() {
    const main = document.getElementById('main');
    const suggestions = buildSuggestions();
    const body = suggestions.length
      ? `<ul class="suggest-list">${suggestions.map(s => `<li>${escapeHtml(s.label)}を外すと <b>${s.count}件</b> になります</li>`).join('')}</ul>`
      : `<p class="detail-note">条件を大きく変えないと候補が見つからないようです。</p>`;

    main.innerHTML = `
      <section class="card-step">
        <h2>条件に合うイベントがありません</h2>
        ${body}
        <div class="btn-row">
          <button type="button" class="btn-ghost" id="g-change">条件を変える</button>
        </div>
      </section>
    `;
    document.getElementById('g-change').addEventListener('click', renderCondition);
  }

  async function init() {
    const main = document.getElementById('main');
    main.innerHTML = '<p class="loading">読み込み中…</p>';
    data = await loadData();
    blockedDates = mergeBlockedDates(data.blockedDatesInitial);
    renderCondition();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
