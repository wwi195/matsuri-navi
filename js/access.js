// access.js — 綾瀬市起点の「車・電車」アクセス比較ブロックの組み立て
(function () {
  function yenOrUnknown(v) {
    return v == null ? '未調査' : `${v.toLocaleString('ja-JP')}円`;
  }
  function minutesOrUnknown(v) {
    return v == null ? '未調査' : `約${v}分`;
  }

  const RISK_LABEL = { low: '空きに余裕あり', mid: '混雑注意', high: '満車リスク高' };

  function renderParking(p) {
    if (!p || !p.available) {
      return `<div class="access-row access-parking">駐車場：なし</div>`;
    }
    const fee = p.maxFeePerDay === 0 ? '無料' : p.maxFeePerDay != null ? `1日${p.maxFeePerDay.toLocaleString('ja-JP')}円まで` : '料金未調査';
    const risk = RISK_LABEL[p.fullRisk] || '';
    const parts = [p.type || '駐車場あり', fee, risk].filter(Boolean).join('・');
    return `
      <div class="access-row access-parking">駐車場：${parts}</div>
      ${p.note ? `<div class="access-note">${escapeHtml(p.note)}</div>` : ''}
    `;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderAccessBlock(ev) {
    const a = ev.access || {};
    const mapQuery = encodeURIComponent((ev.venue && (ev.venue.mapQuery || ev.venue.name)) || ev.name);
    const mapHref = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

    const carHtml = a.car ? `
      <div class="access-box access-car${a.recommend === 'car' ? ' is-recommend' : ''}">
        <div class="access-box-title">車で行く${a.recommend === 'car' ? '<span class="badge-recommend">おすすめ</span>' : ''}</div>
        <div class="access-row">${minutesOrUnknown(a.car.minutes)} / ${a.car.distanceKm != null ? a.car.distanceKm + 'km' : '距離未調査'} / ${a.car.highway ? '高速利用' : '下道'}</div>
        ${a.car.route ? `<div class="access-note">${escapeHtml(a.car.route)}</div>` : ''}
        ${a.car.highway ? `<div class="access-row">通行料：${yenOrUnknown(a.car.tollYen)}</div>` : ''}
        ${renderParking(a.parking)}
        <a class="map-link" target="_blank" rel="noopener" href="${mapHref}">Googleマップで経路を開く</a>
      </div>` : '';

    const trainHtml = a.train ? `
      <div class="access-box access-train${a.recommend === 'train' ? ' is-recommend' : ''}">
        <div class="access-box-title">電車で行く${a.recommend === 'train' ? '<span class="badge-recommend">おすすめ</span>' : ''}</div>
        <div class="access-row">${escapeHtml(a.train.gateway || '')}から${minutesOrUnknown(a.train.minutes)} / ${yenOrUnknown(a.train.fareYen)}</div>
        ${a.train.route ? `<div class="access-note">${escapeHtml(a.train.route)}</div>` : ''}
        <div class="access-note">※綾瀬市内に駅はないため、${escapeHtml(a.train.gateway || '最寄り駅')}まで車かバスで移動</div>
      </div>` : '';

    if (!carHtml && !trainHtml) return '';
    return `<div class="access-block">${carHtml}${trainHtml}</div>`;
  }

  window.MatsuriAccess = { renderAccessBlock, escapeHtml };
})();
