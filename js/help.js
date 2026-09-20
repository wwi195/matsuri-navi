// help.js — 各ページ共通の「？」ヘルプボタンとポップオーバー
(function () {
  function legendRow(rank, note) {
    const img = window.MatsuriData ? window.MatsuriData.scaleImageUrl(rank) : null;
    return `
      <div>
        ${img ? `<img class="scale-legend-thumb" src="${img}" alt="規模ランク${rank}のイメージ" loading="lazy">` : ''}
        <span class="scale scale-${rank}">${rank}</span>${note}
      </div>
    `;
  }

  const HELP_HTML = `
    <h3>規模ランクの目安（例年の来場者数）</h3>
    <div class="scale-legend">
      ${legendRow('S', '〜1万人')}
      ${legendRow('M', '〜5万人')}
      ${legendRow('L', '〜30万人')}
      ${legendRow('XL', '30万人〜')}
    </div>
    <hr class="help-sep">
    <h3>このページについて</h3>
    <p>「まつり・イベントナビ」は、神奈川県綾瀬市を起点に、車・電車で行ける祭り・イベントを探すための家族向けページです。</p>
    <p>
      ・日付順の一覧から気になるイベントを選んで詳細を確認<br>
      ・ジャンル・移動手段・駐車場・子連れ向き度などで絞り込み<br>
      ・NG日（運動会など）を登録すると候補から自動で除外<br>
      ・迷ったら「ガチャ」で条件に合う1件をランダムに提案
    </p>
  `;

  function renderHelpButton() {
    return `
      <span class="help-wrap">
        <button type="button" class="help-btn" id="page-help-btn" aria-label="このページについての説明を表示" aria-expanded="false">？</button>
        <div class="help-pop" id="page-help-pop" role="tooltip" hidden>${HELP_HTML}</div>
      </span>
    `;
  }

  function wireHelpButton() {
    const btn = document.getElementById('page-help-btn');
    const pop = document.getElementById('page-help-pop');
    if (!btn || !pop) return;

    btn.addEventListener('click', e => {
      e.stopPropagation();
      const willOpen = pop.hasAttribute('hidden');
      if (willOpen) {
        pop.removeAttribute('hidden');
        btn.setAttribute('aria-expanded', 'true');
      } else {
        pop.setAttribute('hidden', '');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('click', e => {
      if (e.target.closest('#page-help-btn') || e.target.closest('#page-help-pop')) return;
      pop.setAttribute('hidden', '');
      btn.setAttribute('aria-expanded', 'false');
    });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      pop.setAttribute('hidden', '');
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  function init() {
    const slot = document.getElementById('page-help-slot');
    if (!slot) return;
    slot.innerHTML = renderHelpButton();
    wireHelpButton();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
