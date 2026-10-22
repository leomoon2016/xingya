/* PROTOTYPE（用完即弃）：渲染循环、事件委托、方案切换器（?variant=A|B|C|D）、原型状态面板、呀哈哈队长浮动入口。 */
(function () {
  const { esc } = XY; const A = XYArt;
  const KEYS = ['A', 'B', 'C', 'D'];
  const app = document.getElementById('app');
  const chrome = document.getElementById('proto-chrome');
  let variant = (new URLSearchParams(location.search).get('variant') || 'A').toUpperCase();
  if (!KEYS.includes(variant)) variant = 'A';
  let lastScreen = null;

  function setVariant(v) {
    variant = v;
    const url = new URL(location.href); url.searchParams.set('variant', v);
    history.replaceState(null, '', url);
    document.getElementById('variant-css').setAttribute('href', `variants/${v.toLowerCase()}.css`);
    lastScreen = null;
    render();
  }

  function shared(s) {
    if (s.screen === 'wall') return toastHtml(s);
    const c = XY.child(s);
    const msgs = s.chat.msgs.map((m) => (m.me
      ? `<p class="xy-chat-me">${esc(m.me)}</p>`
      : `<div class="xy-chat-cap"><p>${esc(m.cap)}</p>${m.say ? `<button class="xy-chat-say" data-action="say" data-text="${m.say}" aria-label="播放 ${m.say} 的发音">${A.icons.speaker}</button>` : ''}</div>`)).join('');
    return `
      <button class="xy-captain" data-action="chatToggle" data-fk="captain" aria-expanded="${s.chat.open}" aria-label="和呀哈哈队长聊天">${A.captain('xy-captain-art')}</button>
      ${s.chat.open ? `
      <section class="xy-chat" role="dialog" aria-label="呀哈哈队长">
        <header class="xy-chat-head">${A.captain('xy-chat-face')}<h2>呀哈哈队长</h2>
          <button class="xy-chat-close" data-action="chatToggle" data-fk="chat-close" aria-label="关上聊天">${A.icons.close}</button></header>
        <div class="xy-chat-body">
          <div class="xy-chat-cap"><p>${esc(c.name)}，你好！不会读的英文词、不懂的意思，都可以问我。</p></div>
          ${msgs}
        </div>
        <div class="xy-chat-chips">
          <button data-action="chatSend" data-text="duck 怎么读？">duck 怎么读？</button>
          <button data-action="chatSend" data-text="讲一个动物的英文笑话">讲个英文笑话</button>
        </div>
        <form class="xy-chat-form" data-submit="chatSend">
          <label class="xy-sr" for="chat-input">想问呀哈哈队长什么</label>
          <input id="chat-input" data-fk="chat-input" autocomplete="off" maxlength="60" placeholder="打字问问题">
          <button type="submit" data-fk="chat-send">发送</button>
        </form>
        <p class="xy-chat-left">今天还能聊 ${s.chat.left} 条</p>
      </section>` : ''}
      ${toastHtml(s)}`;
  }
  const toastHtml = (s) => `<div class="xy-toast ${s.toast ? 'is-on' : ''}" role="status" aria-live="polite">${esc(s.toast)}</div>`;

  function stateSummary(s) {
    const c = XY.child(s);
    const rows = [
      ['方案', `${variant}（${XY.variants[variant].name}）`],
      ['屏幕', { wall: '头像墙 / PIN', home: '学习主页', quiz: '闯关答题', finish: '结算' }[s.screen]],
      ['登录的孩子', c ? c.name : '还没登录'],
    ];
    if (s.screen === 'wall') {
      s.children.forEach((k) => rows.push([`${k.name}`, k.lockedUntil > XY.now() ? `锁定中，约 ${XY.lockMinutes(k)} 分钟（错 ${k.fails} 次）` : `PIN ${k.pin}，已错 ${k.fails} 次`]));
    }
    if (c) {
      const cur = XY.currentLevel(XY.courseView(c));
      rows.push(['星星', c.stars], ['碎片', c.fragments], ['今日复习', `${c.reviewDue} 个到期`],
        ['跟随伙伴', `${XY.COMPANIONS[c.companion].name}，经验 ${c.exp}/${c.expNext}`],
        ['当前关卡', cur ? `Unit ${cur.unit.n} 第 ${cur.level.n} 关` : '全部通过']);
    }
    if (s.quiz) {
      const done = Object.keys(s.quiz.answers).length;
      const right = Object.values(s.quiz.answers).filter((a) => a.correct).length;
      rows.push(['作答', `第 ${s.quiz.idx + 1}/${s.quiz.qs.length} 题，已答 ${done}，答对 ${right}`]);
    }
    if (s.result) rows.push(['结算', `对 ${s.result.C}/${s.result.S}，${s.result.stars} 星级，发 ${s.result.awarded} 星星`]);
    if (XY.variants[variant].stateRows) rows.push(...XY.variants[variant].stateRows(s)); // 只有方案 D 有（积分、呀哈哈收藏）
    rows.push(['减少动画', s.reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches ? '开' : '关']);
    return rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
  }

  function renderChrome(s) {
    const name = XY.variants[variant].name;
    chrome.innerHTML = `
      ${s.panel ? `<aside class="pp-panel" aria-label="原型状态">
        <p class="pp-title">原型状态（只在内存里，刷新即重置）</p>
        <dl>${stateSummary(s)}</dl>
        <div class="pp-actions">
          <button data-action="protoUnlock" data-fk="pp-unlock">模拟家长解锁</button>
          ${s.quiz ? '<button data-action="protoFill" data-fk="pp-fill">快进到最后一题</button>' : ''}
          <button data-action="protoMotion" data-fk="pp-motion">切换减少动画</button>
          <button data-action="protoReset" data-fk="pp-reset">重置原型</button>
        </div></aside>` : ''}
      <nav class="pp-switch" aria-label="原型方案切换（不属于设计）">
        <button data-action="pp-prev" data-fk="pp-prev" aria-label="上一个方案">‹</button>
        <span class="pp-label">${variant}（${esc(name)}）</span>
        <button data-action="pp-next" data-fk="pp-next" aria-label="下一个方案">›</button>
        <button class="pp-state" data-action="protoPanel" data-fk="pp-state" aria-expanded="${s.panel}">状态</button>
      </nav>`;
  }

  function render() {
    const s = XY.state;
    const active = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk : null;
    const chatVal = document.getElementById('chat-input') ? document.getElementById('chat-input').value : '';
    document.body.dataset.screen = s.screen;
    document.body.classList.toggle('reduce-motion', s.reduceMotion);
    const v = XY.variants[variant];
    app.className = `v-${variant.toLowerCase()} screen-${s.screen}`;
    app.innerHTML = v.render(s) + shared(s);
    renderChrome(s);
    const ci = document.getElementById('chat-input'); if (ci && chatVal) ci.value = chatVal;
    const screenChanged = lastScreen !== s.screen;
    if (v.after) v.after(s, { screenChanged });
    let target = active && document.querySelector(`[data-fk="${active}"]`);
    if (!target && (screenChanged || active)) target = document.querySelector('[data-autofocus]');
    if (target) target.focus({ preventScroll: !screenChanged });
    if (screenChanged && !v.keepScroll) window.scrollTo(0, 0);
    lastScreen = s.screen;
  }

  function run(el, ev) {
    const name = el.dataset.action;
    if (name === 'pp-prev' || name === 'pp-next') {
      const i = KEYS.indexOf(variant);
      setVariant(KEYS[(i + (name === 'pp-next' ? 1 : KEYS.length - 1)) % KEYS.length]);
      return;
    }
    const fn = XY.actions[name];
    if (fn) { if (ev) ev.preventDefault(); fn({ ...el.dataset }); }
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (el && !el.disabled) run(el, e);
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-submit]');
    if (f) { e.preventDefault(); XY.actions[f.dataset.submit]({}); const i = document.getElementById('chat-input'); if (i) { i.value = ''; i.focus(); } }
  });
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    const typing = t.closest && t.closest('input, textarea, [contenteditable=""], [contenteditable="true"]');
    // SVG 里 role=button 的元素也要能用键盘点
    if ((e.key === 'Enter' || e.key === ' ') && t.getAttribute && t.getAttribute('role') === 'button' && t.dataset.action) { e.preventDefault(); run(t, null); return; }
    if (typing) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const i = KEYS.indexOf(variant);
      setVariant(KEYS[(i + (e.key === 'ArrowRight' ? 1 : KEYS.length - 1)) % KEYS.length]);
      return;
    }
    if (XY.state.screen === 'wall' && XY.state.picked) {
      if (/^[0-9]$/.test(e.key)) XY.actions.digit({ d: e.key });
      else if (e.key === 'Backspace') XY.actions.backspace();
      else if (e.key === 'Escape') XY.actions.unpick();
    }
    if (e.key === 'Escape' && XY.state.chat.open) XY.actions.chatToggle();
  });

  let compact = XY.isCompact();
  window.addEventListener('resize', () => { if (XY.isCompact() !== compact) { compact = XY.isCompact(); lastScreen = null; render(); } });
  setInterval(() => { if (XY.state.screen === 'wall') render(); }, 20000);

  XY.subscribe(render);
  document.getElementById('variant-css').setAttribute('href', `variants/${variant.toLowerCase()}.css`);
  render();
})();
