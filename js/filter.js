// filter.js — 絞り込み・月切り替えタブ
(function () {
  const GENRE_CHIPS = ['祭り', '花火', 'フェス', 'マルシェ', 'イルミ', '市'];
  const SCALE_CHIPS = ['S', 'M', 'L', 'XL'];

  function defaultState() {
    return {
      month: 'all',         // 'all' | 'YYYY-MM'
      genres: [],           // 選択されたジャンル（OR条件）。空 = 全て
      access: 'all',        // 'all' | 'car' | 'train'
      duration: 0,          // 0(指定なし) | 30 | 60 | 90
      parking: 'all',       // 'all' | 'free' | 'paidOk' | 'none'
      kidScore: 0,          // 0(指定なし) | 3 | 4 | 5
      scales: [],           // 選択された規模（OR条件）。空 = 全て
      excludeNg: true,      // NG日を除外する
      source: 'all',         // 'all' | 'user' | 'claude'
    };
  }

  function monthsAvailable(rows) {
    const set = new Set();
    rows.forEach(r => set.add(r.date.start.slice(0, 7)));
    return [...set].sort();
  }

  function monthLabel(ym) {
    const [, m] = ym.split('-');
    return `${parseInt(m, 10)}月`;
  }

  function effectiveMinutes(ev) {
    const a = ev.access || {};
    if (a.car && a.car.minutes != null) return a.car.minutes;
    if (a.train && a.train.minutes != null) return a.train.minutes;
    return null;
  }

  function matchesParking(ev, mode) {
    if (mode === 'all') return true;
    const p = ev.access && ev.access.parking;
    if (mode === 'none') return !p || !p.available;
    if (!p || !p.available) return false;
    if (mode === 'free') return p.maxFeePerDay === 0;
    if (mode === 'paidOk') return true; // 無料・有料どちらも可（駐車場ありなら可）
    return true;
  }

  function matchesAccess(ev, mode) {
    if (mode === 'all') return true;
    const a = ev.access || {};
    if (mode === 'car') return !!a.car;
    if (mode === 'train') return !a.car && !!a.train;
    return true;
  }

  function isBlockedRow(row, blockedDates) {
    return blockedDates.some(b => b.date >= row.date.start && b.date <= row.date.end);
  }

  function applyFilters(rows, state, blockedDates) {
    return rows.filter(row => {
      const ev = row.event;
      if (state.month !== 'all' && row.date.start.slice(0, 7) !== state.month) return false;
      if (state.genres.length > 0 && !(ev.genre || []).some(g => state.genres.includes(g))) return false;
      if (!matchesAccess(ev, state.access)) return false;
      if (state.duration > 0) {
        const mins = effectiveMinutes(ev);
        if (mins == null || mins > state.duration) return false;
      }
      if (!matchesParking(ev, state.parking)) return false;
      if (state.kidScore > 0) {
        const score = ev.audience && ev.audience.kidScore;
        if (score == null || score < state.kidScore) return false;
      }
      if (state.scales.length > 0 && !state.scales.includes(ev.scale && ev.scale.sizeRank)) return false;
      if (state.source !== 'all' && window.MatsuriData.sourceInfo(ev).key !== state.source) return false;
      if (state.excludeNg && isBlockedRow(row, blockedDates)) return false;
      return true;
    });
  }

  function chipHtml(value, label, isActive, dataAttr) {
    return `<button type="button" class="chip${isActive ? ' is-active' : ''}" data-${dataAttr}="${value}">${label}</button>`;
  }

  function renderMonthTabs(container, months, state, onChange) {
    const tabs = ['all', ...months];
    container.innerHTML = tabs.map(m => {
      const label = m === 'all' ? 'すべて' : monthLabel(m);
      return `<button type="button" class="month-tab${state.month === m ? ' is-active' : ''}" data-month="${m}">${label}</button>`;
    }).join('');
    container.querySelectorAll('.month-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        state.month = btn.dataset.month;
        onChange(state);
      });
    });
  }

  function renderFilterPanel(container, state, onChange) {
    container.innerHTML = `
      <div class="filter-toggle-row">
        <button type="button" class="filter-toggle" id="filter-toggle-btn" aria-expanded="false">絞り込み <span class="filter-toggle-arrow">▼</span></button>
        <label class="ng-exclude-toggle">
          <input type="checkbox" id="filter-exclude-ng" ${state.excludeNg ? 'checked' : ''}>
          NG日を除外する
        </label>
      </div>
      <div class="filter-panel" id="filter-panel" hidden>
        <div class="frow">
          <span class="frow-label">ジャンル</span>
          <div class="chip-row" id="filter-genre">${GENRE_CHIPS.map(g => chipHtml(g, g, state.genres.includes(g), 'genre')).join('')}</div>
        </div>
        <div class="frow">
          <span class="frow-label">移動手段</span>
          <div class="chip-row" id="filter-access">
            ${chipHtml('all', '指定なし', state.access === 'all', 'access')}
            ${chipHtml('car', '車で行ける', state.access === 'car', 'access')}
            ${chipHtml('train', '電車のみ', state.access === 'train', 'access')}
          </div>
        </div>
        <div class="frow">
          <span class="frow-label">所要時間</span>
          <div class="chip-row" id="filter-duration">
            ${chipHtml(0, '指定なし', state.duration === 0, 'duration')}
            ${chipHtml(30, '30分以内', state.duration === 30, 'duration')}
            ${chipHtml(60, '60分以内', state.duration === 60, 'duration')}
            ${chipHtml(90, '90分以内', state.duration === 90, 'duration')}
          </div>
        </div>
        <div class="frow">
          <span class="frow-label">駐車場</span>
          <div class="chip-row" id="filter-parking">
            ${chipHtml('all', '指定なし', state.parking === 'all', 'parking')}
            ${chipHtml('free', '無料あり', state.parking === 'free', 'parking')}
            ${chipHtml('paidOk', '有料可', state.parking === 'paidOk', 'parking')}
            ${chipHtml('none', 'なし', state.parking === 'none', 'parking')}
          </div>
        </div>
        <div class="frow">
          <span class="frow-label">子連れ向き度</span>
          <div class="chip-row" id="filter-kid">
            ${chipHtml(0, '指定なし', state.kidScore === 0, 'kid')}
            ${chipHtml(3, '★3以上', state.kidScore === 3, 'kid')}
            ${chipHtml(4, '★4以上', state.kidScore === 4, 'kid')}
            ${chipHtml(5, '★5', state.kidScore === 5, 'kid')}
          </div>
        </div>
        <div class="frow">
          <span class="frow-label">規模</span>
          <div class="chip-row" id="filter-scale">${SCALE_CHIPS.map(s => chipHtml(s, s, state.scales.includes(s), 'scale')).join('')}</div>
        </div>
        <div class="frow">
          <span class="frow-label">出所</span>
          <div class="chip-row" id="filter-source">
            ${chipHtml('all', 'すべて', state.source === 'all', 'source')}
            ${chipHtml('user', '📌 あなたの指定のみ', state.source === 'user', 'source')}
            ${chipHtml('claude', '✨ AI提案のみ', state.source === 'claude', 'source')}
          </div>
        </div>
      </div>
    `;

    const toggleBtn = container.querySelector('#filter-toggle-btn');
    const panel = container.querySelector('#filter-panel');
    toggleBtn.addEventListener('click', () => {
      const isHidden = panel.hasAttribute('hidden');
      if (isHidden) panel.removeAttribute('hidden'); else panel.setAttribute('hidden', '');
      toggleBtn.setAttribute('aria-expanded', String(isHidden));
    });

    container.querySelector('#filter-exclude-ng').addEventListener('change', e => {
      state.excludeNg = e.target.checked;
      onChange(state);
    });

    function wireMultiChip(selector, stateKey, castFn) {
      container.querySelectorAll(`${selector} .chip`).forEach(btn => {
        btn.addEventListener('click', () => {
          const val = castFn(btn.dataset[stateKey]);
          const list = state[stateKey === 'genre' ? 'genres' : 'scales'];
          const idx = list.indexOf(val);
          if (idx >= 0) list.splice(idx, 1); else list.push(val);
          onChange(state);
        });
      });
    }
    wireMultiChip('#filter-genre', 'genre', String);
    wireMultiChip('#filter-scale', 'scale', String);

    function wireSingleChip(selector, stateKey, castFn) {
      container.querySelectorAll(`${selector} .chip`).forEach(btn => {
        btn.addEventListener('click', () => {
          state[stateKey] = castFn(btn.dataset[stateKey]);
          onChange(state);
        });
      });
    }
    wireSingleChip('#filter-access', 'access', String);
    wireSingleChip('#filter-duration', 'duration', Number);
    wireSingleChip('#filter-parking', 'parking', String);
    wireSingleChip('#filter-kid', 'kidScore', Number);
    wireSingleChip('#filter-source', 'source', String);
  }

  // renderFilterPanelは初回のDOM構築のみを担う（パネルの開閉状態を保つため再構築しない）。
  // チップの選択状態はここでstateに合わせて反映し直す。
  function updateFilterChipStates(container, state) {
    container.querySelectorAll('#filter-genre .chip').forEach(b => b.classList.toggle('is-active', state.genres.includes(b.dataset.genre)));
    container.querySelectorAll('#filter-access .chip').forEach(b => b.classList.toggle('is-active', state.access === b.dataset.access));
    container.querySelectorAll('#filter-duration .chip').forEach(b => b.classList.toggle('is-active', state.duration === Number(b.dataset.duration)));
    container.querySelectorAll('#filter-parking .chip').forEach(b => b.classList.toggle('is-active', state.parking === b.dataset.parking));
    container.querySelectorAll('#filter-kid .chip').forEach(b => b.classList.toggle('is-active', state.kidScore === Number(b.dataset.kid)));
    container.querySelectorAll('#filter-scale .chip').forEach(b => b.classList.toggle('is-active', state.scales.includes(b.dataset.scale)));
    container.querySelectorAll('#filter-source .chip').forEach(b => b.classList.toggle('is-active', state.source === b.dataset.source));
  }

  window.MatsuriFilter = {
    defaultState,
    monthsAvailable,
    monthLabel,
    applyFilters,
    renderMonthTabs,
    renderFilterPanel,
    updateFilterChipStates,
  };
})();
