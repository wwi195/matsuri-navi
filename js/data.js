// data.js — events.json / blocked-dates.json の読み込みと正規化
(function () {
  const DATA_URLS = { events: 'data/events.json', blocked: 'data/blocked-dates.json' };

  // ジャンルの色分けルール（最大5色）。上から順に最初に一致したものを採用する。
  // 神社行事系は色バジェットの外＝別カテゴリとして扱う。
  const GENRE_CATEGORY_RULES = [
    { key: 'shrine', label: '神社行事・縁起もの', match: g => g.includes('神社行事') || g.includes('縁起もの') || g.includes('御守頒布') },
    { key: 'hanabi', label: '花火', match: g => g.includes('花火') },
    { key: 'illumination', label: 'イルミ', match: g => g.includes('イルミ') || g.includes('夜間開園') },
    { key: 'ichi', label: '市・マルシェ', match: g => g.includes('マルシェ') || g.includes('市') || g.includes('骨董') || g.includes('フリマ') || g.includes('ハンドメイド') },
    { key: 'fes', label: 'フェス', match: g => g.includes('フェス') || g.includes('大道芸') || g.includes('グルメ') },
  ];
  const DEFAULT_CATEGORY = { key: 'matsuri', label: '祭り' };

  function genreCategory(event) {
    const g = event.genre || [];
    for (const rule of GENRE_CATEGORY_RULES) {
      if (rule.match(g)) return rule;
    }
    return DEFAULT_CATEGORY;
  }

  function isShrineEvent(event) {
    return genreCategory(event).key === 'shrine';
  }

  // イベントの「出所」（ユーザー指定 / AI提案）。不正・欠損値は claude 扱いにフォールバックする。
  const SOURCE_INFO = {
    user: { key: 'user', label: "尚's セレクト", icon: '📌' },
    claude: { key: 'claude', label: 'AI提案', icon: '✨' },
  };

  function normalizeSource(events) {
    events.forEach(ev => {
      if (ev.source !== 'user' && ev.source !== 'claude') ev.source = 'claude';
    });
  }

  function sourceInfo(event) {
    return SOURCE_INFO[event.source] || SOURCE_INFO.claude;
  }

  // 規模ランクごとのイメージ画像。不明なランクは画像なし扱い。
  const SCALE_IMAGE = {
    S: 'images/scale-S.jpg',
    M: 'images/scale-M.jpg',
    L: 'images/scale-L.jpg',
    XL: 'images/scale-XL.jpg',
  };

  function scaleImageUrl(rank) {
    return SCALE_IMAGE[rank] || null;
  }

  let _cache = null;
  async function loadData() {
    if (_cache) return _cache;
    const [eventsDoc, blockedDoc] = await Promise.all([
      fetch(DATA_URLS.events).then(r => r.json()),
      fetch(DATA_URLS.blocked).then(r => r.json()),
    ]);
    normalizeSource(eventsDoc.events);
    _cache = {
      origin: eventsDoc.origin,
      events: eventsDoc.events,
      blockedDatesInitial: blockedDoc,
    };
    return _cache;
  }

  function getEventById(data, id) {
    return data.events.find(e => e.id === id) || null;
  }

  // イベントを日付ごとの「出現」に展開し、開始日順に並べる
  function occurrences(data) {
    const rows = [];
    for (const ev of data.events) {
      ev.dates.forEach((d, dateIndex) => {
        rows.push({ event: ev, date: d, dateIndex, sortKey: d.start });
      });
    }
    rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.event.name.localeCompare(b.event.name, 'ja'));
    return rows;
  }

  function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'];
  function formatDateRange(dateObj) {
    const start = new Date(dateObj.start + 'T00:00:00');
    const startLabel = `${start.getMonth() + 1}/${start.getDate()}(${WEEKDAY_JA[start.getDay()]})`;
    if (!dateObj.end || dateObj.end === dateObj.start) return startLabel;
    const end = new Date(dateObj.end + 'T00:00:00');
    if (end.getMonth() === start.getMonth()) {
      return `${start.getMonth() + 1}/${start.getDate()}〜${end.getDate()}(${WEEKDAY_JA[start.getDay()]}〜${WEEKDAY_JA[end.getDay()]})`;
    }
    return `${startLabel}〜${end.getMonth() + 1}/${end.getDate()}(${WEEKDAY_JA[end.getDay()]})`;
  }

  window.MatsuriData = {
    loadData,
    getEventById,
    occurrences,
    genreCategory,
    isShrineEvent,
    sourceInfo,
    scaleImageUrl,
    todayStr,
    formatDateRange,
    GENRE_CATEGORY_RULES,
    DEFAULT_CATEGORY,
  };
})();
