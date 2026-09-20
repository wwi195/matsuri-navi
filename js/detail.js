// detail.js — イベント詳細画面の描画
(function () {
  const { loadData, getEventById, occurrences, genreCategory, sourceInfo, formatDateRange, todayStr } = window.MatsuriData;
  const { mergeBlockedDates, getVisitedRecord, markVisited, unmarkVisited } = window.MatsuriStorage;
  const { renderAccessBlock, escapeHtml } = window.MatsuriAccess;

  const RISK_NOTE = { S: '〜1万人', M: '〜5万人', L: '〜30万人', XL: '30万人〜' };
  const CROWD_LABEL = ['', '空いている', 'やや空いている', '普通', '混雑', '身動きが取れないレベル'];

  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }

  function overviewLine(ev) {
    const genreText = (ev.genre || []).join('・');
    const venueName = (ev.venue && ev.venue.name) || '';
    return `${genreText}のイベント。会場は${venueName}。`;
  }

  function scaleSection(ev) {
    const s = ev.scale || {};
    const visitors = s.visitors != null ? `${s.visitors.toLocaleString('ja-JP')}人${s.visitorsNote ? '（' + escapeHtml(s.visitorsNote) + '）' : ''}` : `未調査${s.visitorsNote ? '（' + escapeHtml(s.visitorsNote) + '）' : ''}`;
    const rankNote = s.sizeRank ? `${s.sizeRank}（${RISK_NOTE[s.sizeRank] || ''}）` : '未調査';
    const crowd = ev.audience && ev.audience.crowdLevel ? CROWD_LABEL[ev.audience.crowdLevel] : '未調査';
    return `
      <div class="detail-row">規模ランク：${rankNote}</div>
      <div class="detail-row">例年の来場者数：${visitors}</div>
      <div class="detail-row">混雑度：${crowd}</div>
    `;
  }

  function stallsSection(ev) {
    const st = ev.stalls || {};
    const highlight = (st.highlight || []).map(escapeHtml).join('・');
    return `
      <div class="detail-row">出店レベル：${st.level || '未調査'}${st.count != null ? `（約${st.count}店）` : ''}</div>
      ${highlight ? `<div class="detail-row">名物：${highlight}</div>` : ''}
      ${st.note ? `<div class="detail-note">${escapeHtml(st.note)}</div>` : ''}
    `;
  }

  function audienceSection(ev) {
    const au = ev.audience || {};
    const stars = '★'.repeat(au.kidScore || 0) + '☆'.repeat(5 - (au.kidScore || 0));
    return `
      <div class="detail-row">主な年齢層：${(au.ageGroups || []).map(escapeHtml).join('・') || '未調査'}</div>
      <div class="detail-row">子連れ向き度：<span class="kid-score">${stars}</span></div>
      ${au.nightEvent ? `<div class="detail-note">夜まで続くイベントです。帰りの混雑にご注意ください。</div>` : ''}
    `;
  }

  function costWeatherSection(ev) {
    const cost = ev.cost || {};
    const entry = cost.entryYen === 0 ? '無料' : cost.entryYen != null ? `${cost.entryYen.toLocaleString('ja-JP')}円` : '未調査';
    return `
      <div class="detail-row">入場料：${entry}${cost.note ? `（${escapeHtml(cost.note)}）` : ''}</div>
      <div class="detail-row">荒天時：${escapeHtml(ev.weather || '未調査')}</div>
      ${ev.rainDate ? `<div class="detail-note">荒天時の順延日：${escapeHtml(ev.rainDate.date)}${ev.rainDate.note ? '　' + escapeHtml(ev.rainDate.note) : ''}</div>` : ''}
      ${ev.official ? `<div class="detail-row"><a href="${escapeHtml(ev.official)}" target="_blank" rel="noopener">公式サイト</a></div>` : ''}
    `;
  }

  function todoSection(ev) {
    const todo = (ev.dataQuality && ev.dataQuality.todo) || [];
    if (todo.length === 0) return '';
    return `
      <section class="detail-section detail-section-todo">
        <h2>未調査項目</h2>
        <p class="todo-list">${todo.map(escapeHtml).join('・')}（情報募集中）</p>
      </section>
    `;
  }

  function vendorInfoSection(ev) {
    if (!ev.vendorInfo) return '';
    const entries = Object.entries(ev.vendorInfo).map(([k, v]) => `<div class="detail-row">${escapeHtml(k)}：${escapeHtml(String(v))}</div>`).join('');
    return `
      <details class="detail-section detail-section-vendor">
        <summary>出店者向け情報</summary>
        ${entries}
      </details>
    `;
  }

  function nearbyEventsHtml(data, currentEvent, currentDate) {
    const today = todayStr();
    const base = new Date(currentDate.start + 'T00:00:00');
    const from = new Date(base); from.setDate(from.getDate() - 3);
    const to = new Date(base); to.setDate(to.getDate() + 3);
    const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const fromStr = fmt(from), toStr = fmt(to);

    const rows = occurrences(data).filter(r => {
      if (r.event.id === currentEvent.id && r.date.start === currentDate.start) return false;
      if (r.date.end < today) return false;
      return r.date.start <= toStr && r.date.end >= fromStr;
    });

    if (rows.length === 0) {
      return `<p class="empty">前後3日以内の他イベントはありません。</p>`;
    }
    return `<ul class="nearby-list">${rows.map(r => `
      <li><a href="event.html?id=${encodeURIComponent(r.event.id)}&d=${r.dateIndex}">
        <span class="nearby-date">${formatDateRange(r.date)}</span>
        <span class="nearby-name">${escapeHtml(r.event.name)}</span>
      </a></li>`).join('')}</ul>`;
  }

  function pastVisitLabel(visitedRecord, dateObj) {
    if (!visitedRecord || visitedRecord.date >= dateObj.start) return '';
    const visitedYear = parseInt(visitedRecord.date.slice(0, 4), 10);
    const thisYear = parseInt(dateObj.start.slice(0, 4), 10);
    const diff = thisYear - visitedYear;
    if (diff <= 0) return '';
    return diff === 1 ? '去年行った' : `${diff}年前に行った`;
  }

  async function render() {
    const main = document.getElementById('main');
    main.innerHTML = '<p class="loading">読み込み中…</p>';
    const data = await loadData();
    const id = qs('id');
    const ev = getEventById(data, id);

    if (!ev) {
      main.innerHTML = '<p class="empty">イベントが見つかりませんでした。<a href="index.html">一覧に戻る</a></p>';
      return;
    }

    const dateIndex = Math.min(Math.max(parseInt(qs('d') || '0', 10) || 0, 0), ev.dates.length - 1);
    const dateObj = ev.dates[dateIndex];
    const blockedDates = mergeBlockedDates(data.blockedDatesInitial);
    const block = blockedDates.find(b => b.date >= dateObj.start && b.date <= dateObj.end);
    const cat = genreCategory(ev);
    const src = sourceInfo(ev);
    const visitedRecord = getVisitedRecord(ev.id);
    const isThisDateVisited = !!visitedRecord && visitedRecord.date === dateObj.start;
    const pastLabel = pastVisitLabel(visitedRecord, dateObj);

    document.title = `${ev.name}｜まつり・イベントナビ`;

    main.innerHTML = `
      <a class="back-link" href="index.html">← 一覧に戻る</a>
      <article class="detail cat-${cat.key}">
        <header class="detail-header">
          <span class="source-badge source-badge-lg source-${src.key}">${src.icon} ${src.label}</span>
          <h1 class="detail-title">${escapeHtml(ev.name)}</h1>
          <div class="detail-date">${formatDateRange(dateObj)}${dateObj.timeStart ? `　${dateObj.timeStart}〜${dateObj.timeEnd || ''}` : ''}${dateObj.label ? ` <span class="date-tag">${escapeHtml(dateObj.label)}</span>` : ''}</div>
          ${ev.recurrence ? `<div class="detail-recurrence">${escapeHtml(ev.recurrence)}</div>` : ''}
          ${pastLabel ? `<div class="visited-note">${escapeHtml(pastLabel)}</div>` : ''}
          ${block ? `<div class="ng-badge ng-badge-large">${escapeHtml(block.label || 'NG日')}と重なっています</div>` : ''}
          <button type="button" class="btn-visited${isThisDateVisited ? ' is-visited' : ''}" id="visited-toggle-btn">${isThisDateVisited ? '✓ 行った' : '行った'}</button>
        </header>

        <section class="detail-section">
          <p class="overview">${escapeHtml(overviewLine(ev))}</p>
        </section>

        <section class="detail-section">
          <h2>歴史・由来</h2>
          <div class="detail-row">${ev.history && ev.history.since ? `${ev.history.since}年〜` : ''}${ev.history && ev.history.edition ? `（第${ev.history.edition}回）` : ''}</div>
          <p class="detail-note">${escapeHtml((ev.history && ev.history.summary) || '未調査')}</p>
        </section>

        <section class="detail-section">
          <h2>規模</h2>
          ${scaleSection(ev)}
        </section>

        <section class="detail-section">
          <h2>出店</h2>
          ${stallsSection(ev)}
        </section>

        <section class="detail-section">
          <h2>年齢層・子連れ向き</h2>
          ${audienceSection(ev)}
        </section>

        <section class="detail-section">
          <h2>アクセス（綾瀬市起点）</h2>
          ${renderAccessBlock(ev)}
        </section>

        <section class="detail-section">
          <h2>費用・天候</h2>
          ${costWeatherSection(ev)}
        </section>

        ${ev.memo ? `<section class="detail-section"><h2>メモ</h2><p class="detail-note">${escapeHtml(ev.memo)}</p></section>` : ''}

        ${vendorInfoSection(ev)}
        ${todoSection(ev)}

        <section class="detail-section">
          <h2>同じ日・前後3日の他イベント</h2>
          ${nearbyEventsHtml(data, ev, dateObj)}
        </section>
      </article>
    `;

    document.getElementById('visited-toggle-btn').addEventListener('click', () => {
      if (isThisDateVisited) unmarkVisited(ev.id);
      else markVisited(ev.id, dateObj.start);
      render();
    });
  }

  document.addEventListener('DOMContentLoaded', render);
})();
