// storage.js — localStorage（NG日の追加・訪問記録・お気に入り）
(function () {
  const KEYS = {
    blocked: 'matsuri-navi:blockedDates',
    visited: 'matsuri-navi:visited',
    favorites: 'matsuri-navi:favorites',
  };

  function safeGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function safeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // localStorage無効環境（プライベートモード等）でも画面は壊さない
    }
  }

  function getUserBlockedDates() {
    return safeGet(KEYS.blocked, []);
  }
  function addBlockedDate(date, label) {
    const list = getUserBlockedDates().filter(b => b.date !== date);
    list.push({ date, label: label || '予定あり', type: 'ng' });
    safeSet(KEYS.blocked, list);
  }
  function removeBlockedDate(date) {
    safeSet(KEYS.blocked, getUserBlockedDates().filter(b => b.date !== date));
  }

  // 初期データ（data/blocked-dates.json）とユーザー追加分をマージ。同じ日付はユーザー分を優先。
  function mergeBlockedDates(initial) {
    const map = new Map();
    initial.forEach(b => map.set(b.date, b));
    getUserBlockedDates().forEach(b => map.set(b.date, b));
    return [...map.values()];
  }

  function getVisited() {
    return safeGet(KEYS.visited, {});
  }
  function markVisited(eventId, date) {
    const v = getVisited();
    v[eventId] = { date, visitedAt: new Date().toISOString() };
    safeSet(KEYS.visited, v);
  }
  function unmarkVisited(eventId) {
    const v = getVisited();
    delete v[eventId];
    safeSet(KEYS.visited, v);
  }
  function isVisited(eventId) {
    return !!getVisited()[eventId];
  }
  function getVisitedRecord(eventId) {
    return getVisited()[eventId] || null;
  }

  function getFavorites() {
    return safeGet(KEYS.favorites, []);
  }
  function toggleFavorite(eventId) {
    const list = getFavorites();
    const idx = list.indexOf(eventId);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(eventId);
    safeSet(KEYS.favorites, list);
    return list.includes(eventId);
  }
  function isFavorite(eventId) {
    return getFavorites().includes(eventId);
  }

  window.MatsuriStorage = {
    getUserBlockedDates,
    addBlockedDate,
    removeBlockedDate,
    mergeBlockedDates,
    getVisited,
    markVisited,
    unmarkVisited,
    isVisited,
    getVisitedRecord,
    getFavorites,
    toggleFavorite,
    isFavorite,
  };
})();
