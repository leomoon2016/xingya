/* PROTOTYPE（用完即弃）方案 B「贴纸本」：任务优先。左页“今天做什么”，右页按单元分页的贴纸格；过一关贴一张模切贴纸。 */
(function () {
  const A = XYArt; const { esc, ui } = XY;
  const tilt = ['-4', '3', '-2', '5', '-3', '2'];
  const U3 = ['cat', 'duck', 'bird', 'rabbit', 'dog'];
  const paint = ['#E8483F', '#3D7BE0', '#F2C230', '#36B37E'];
  function stickerArt(unitKey, n) {
    if (unitKey === 'u03') return A.animalPlain(U3[n - 1], 'b-st-art');
    if (unitKey === 'u02') return A.svg(n === 4
      ? '<path d="M14 84 a46 46 0 0 1 92 0" stroke="#E8483F" stroke-width="10" fill="none"/><path d="M26 84 a34 34 0 0 1 68 0" stroke="#F2C230" stroke-width="10" fill="none"/><path d="M38 84 a22 22 0 0 1 44 0" stroke="#3D7BE0" stroke-width="10" fill="none"/>'
      : `<path d="M60 18 C88 16 104 40 100 62 C108 82 86 104 62 100 C36 108 14 88 20 64 C10 40 32 20 60 18Z" fill="${paint[n - 1]}"/><circle cx="96" cy="26" r="7" fill="${paint[n - 1]}"/><circle cx="20" cy="98" r="5" fill="${paint[n - 1]}"/>`, 'b-st-art');
    if (unitKey === 'u01') return A.svg(`<path d="M18 28 h84 a10 10 0 0 1 10 10 v40 a10 10 0 0 1 -10 10 h-50 l-18 16 v-16 h-16 a10 10 0 0 1 -10 -10 v-40 a10 10 0 0 1 10 -10Z" fill="#FFE04A" stroke="#251D4F" stroke-width="4"/><text x="60" y="68" text-anchor="middle" class="b-st-hi">${['Hi!', 'Good', 'Name', 'Bye!'][n - 1]}</text>`, 'b-st-art');
    return '';
  }
  const stamps = (n) => `<span class="b-stamps" aria-hidden="true">${[1, 2, 3].map((i) => A.star(i <= n, 'b-stamp')).join('')}</span>`;

  // ---------- 头像墙 ----------
  function wall(s) {
    const picked = s.children.find((c) => c.id === s.picked);
    const stickers = s.children.map((c, i) => {
      const locked = c.lockedUntil > XY.now();
      return `<li><button class="b-name ${s.picked === c.id ? 'is-picked' : ''} ${locked ? 'is-locked' : ''} t${i}" data-action="pick" data-id="${c.id}" data-fk="name-${c.id}" ${i === 0 && !s.picked ? 'data-autofocus' : ''} aria-label="${esc(c.name)}${locked ? '，已锁定' : ''}">
        <span class="b-sticker">${A.avatar(c.avatar, 'b-name-av')}</span>
        <span class="b-name-label">${esc(c.name)}</span>
        ${locked ? `<span class="b-lock-stamp">${A.icons.lock}锁住了</span>` : ''}
      </button></li>`;
    }).join('');
    let right;
    if (!picked) right = '<div class="b-page-empty"><p class="b-hand">选一张你的贴纸</p><p>点左边你的头像</p></div>';
    else {
      const m = XY.pinMessage(picked);
      right = m.kind === 'locked'
        ? `<div class="b-locked" role="alert">${A.icons.lock}<p class="b-hand">${esc(picked.name)}的本子锁上了</p><p class="b-msg-strong">${m.text}</p><p>${m.sub}</p><button class="b-btn-line" data-action="unpick" data-fk="unpick" data-autofocus>换一个人</button></div>`
        : `<p class="b-hand">${esc(picked.name)}，输入你的 PIN</p>
           ${ui.pinDots('b-dots', s.pin.length)}
           <p class="b-msg ${m.kind === 'wrong' ? 'is-wrong' : ''}" role="${m.kind ? 'alert' : 'status'}">${m.kind === 'wrong' ? `${m.text}，${m.sub}` : '4 位数字'}</p>
           ${ui.keypad('b-keys')}
           <button class="b-btn-line" data-action="unpick" data-fk="unpick">不是我</button>`;
    }
    return `<div class="b-desk"><div class="b-book b-book-wall">
      <section class="b-page b-left"><h1 class="b-title">谁来学习？</h1><ul class="b-names">${stickers}</ul>
        <button class="b-link" data-action="parentEntry" data-fk="parent">家长入口</button></section>
      <section class="b-page b-right ${picked && s.pinError.startsWith('wrong') ? 'is-shake' : ''}" aria-label="输入 PIN">${right}</section>
    </div></div>`;
  }

  // ---------- 主页 ----------
  function home(s) {
    const c = XY.child(s); const comp = XY.COMPANIONS[c.companion];
    const view = XY.courseView(c); const cur = XY.currentLevel(view);
    const shown = view.find((u) => u.key === s.viewUnit) || (cur ? cur.unit : view[view.length - 1]);
    const tabs = view.map((u) => `<li><button class="b-tab ${u.key === shown.key ? 'is-on' : ''} ${u.unlocked ? '' : 'is-locked'}" data-action="viewUnit" data-key="${u.key}" data-fk="tab-${u.key}" aria-pressed="${u.key === shown.key}" aria-label="Unit ${u.n} ${u.en}${u.unlocked ? '' : '，未解锁'}">
      <span class="b-tab-n">${u.n}</span><span class="b-tab-en" lang="en">${esc(u.en)}</span>${u.unlocked ? '' : A.icons.lock}</button></li>`).join('');
    const slots = shown.levels.map((l, i) => {
      if (l.status === 'done') {
        return `<li><button class="b-slot is-done" data-action="play" data-level="${l.id}" data-fk="slot-${l.id}" aria-label="第 ${l.n} 关，${l.best} 星级，再玩一次">
          <span class="b-sticker t${i % 6}">${stickerArt(shown.key, l.n)}</span>${stamps(l.best)}
          <span class="b-slot-cap"><b>${l.n}</b> <span lang="en">${esc(l.title)}</span></span></button></li>`;
      }
      if (l.status === 'current') {
        return `<li><button class="b-slot is-current" data-action="play" data-level="${l.id}" data-fk="slot-${l.id}" aria-label="第 ${l.n} 关，现在学这一关">
          <span class="b-slot-hole"><b>${l.n}</b><span>贴这一张</span></span>
          <span class="b-slot-cap"><b>${l.n}</b> <span lang="en">${esc(l.title)}</span></span></button></li>`;
      }
      return `<li><button class="b-slot is-locked" data-action="lockedLevel" data-fk="slot-${l.id}" aria-label="第 ${l.n} 关，还没解锁">
        <span class="b-slot-hole"><b>${l.n}</b>${A.icons.lock}</span><span class="b-slot-cap"><b>${l.n}</b> <span lang="en">${esc(l.title)}</span></span></button></li>`;
    }).join('');
    return `<div class="b-desk"><div class="b-book b-book-home">
      <section class="b-page b-left b-today">
        <div class="b-who">${A.avatar(c.avatar, 'b-who-av')}<span>${esc(c.name)}</span><button class="b-btn-line b-small" data-action="switchChild" data-fk="switch">换人</button></div>
        <h1 class="b-title">今天</h1>
        ${cur ? `<button class="b-go" data-action="play" data-level="${cur.level.id}" data-fk="go" data-autofocus>
            <span class="b-go-main">继续 Unit ${cur.unit.n} 第 ${cur.level.n} 关</span>
            <span class="b-go-sub" lang="en">${esc(cur.level.title)}</span></button>` : '<p class="b-hand">这本全部贴满啦</p>'}
        <button class="b-review" data-action="review" data-fk="review">${A.icons.review}<span>复习 <b>${c.reviewDue}</b> 个词</span></button>
        <div class="b-bag">
          <p><span class="b-bag-ic">${A.star(true, 'b-ic-star')}</span><b>${c.stars}</b> 星星</p>
          <p><span class="b-bag-ic">${A.icons.fragment}</span><b>${c.fragments}</b> 碎片</p>
        </div>
        <div class="b-pal">${A.companion(comp, 'idle', 'b-pal-art')}<p><b>${esc(comp.name)}</b>跟着你<br><span>经验 ${c.exp} / ${c.expNext}</span></p></div>
      </section>
      <section class="b-page b-right b-unit" aria-label="Unit ${shown.n} ${esc(shown.en)}">
        <p class="b-course">一年级上册</p>
        <h2 class="b-unit-title"><span lang="en">Unit ${shown.n} ${esc(shown.en)}</span> <span class="b-unit-cn">${esc(shown.cn)}</span></h2>
        <p class="b-unit-count">${shown.unlocked ? `已贴 ${shown.passed} / ${shown.levels.length} 张${shown.three ? `，${shown.three} 张 3 星级` : ''}` : `完成 Unit ${shown.n - 1} 后打开这一页`}</p>
        <ul class="b-slots">${slots}</ul>
      </section>
      <nav class="b-tabs" aria-label="单元"><ul>${tabs}</ul></nav>
    </div></div>`;
  }

  // ---------- 闯关 ----------
  function quiz(s) {
    const q = s.quiz; const info = ui.qinfo(q); const { item, ans } = info;
    const firstOpen = q.qs.findIndex((_, i) => !q.answers[i]);
    const unit = XY.UNITS.find((u) => q.level.startsWith(u.key));
    const prog = q.qs.map((_, i) => {
      const a = q.answers[i];
      const can = a || i === firstOpen;
      return `<li><button class="b-pdot ${a ? (a.correct ? 'is-right' : 'is-wrong') : ''} ${i === q.idx ? 'is-here' : ''}" data-action="goto" data-i="${i}" data-fk="p-${i}" ${can ? '' : 'disabled'} aria-label="第 ${i + 1} 题${a ? (a.correct ? '，答对了' : '，答错了') : ''}">${i + 1}</button></li>`;
    }).join('');
    let left; let right;
    if (item.type === 'order') {
      const show = ans ? ans.response.split(' ') : q.picked.map((k) => item.tiles[k].t);
      left = `<div class="b-q-pic">${A.animalPlain(item.animal, 'b-q-art b-q-art-sm')}<button class="b-say" data-action="say" data-text="${item.answer}" data-fk="say" aria-label="听这句话">${A.icons.speaker}</button></div>
        <div class="b-lines ${ans ? (ans.correct ? 'is-right' : 'is-wrong') : ''}" aria-label="排好的句子">${item.tiles.map((_, i) => (show[i]
          ? `<button class="b-word" lang="en" ${ans ? 'disabled' : `data-action="untile" data-i="${q.picked[i]}" data-fk="slot-${i}"`}>${esc(show[i])}</button>`
          : '<span class="b-word-gap"></span>')).join('')}</div>`;
      right = ans ? '' : `<div class="b-tiles">${item.tiles.map((t, i) => (q.picked.includes(i) ? '' : `<button class="b-tile" lang="en" data-action="tile" data-i="${i}" data-fk="tile-${i}">${esc(t.t)}</button>`)).join('')}</div>
        <button class="b-btn" data-action="checkOrder" data-fk="check" ${q.picked.length < item.tiles.length ? 'disabled' : ''}>排好了</button>`;
    } else {
      left = item.type === 'pick_image'
        ? `<div class="b-q-pic">${A.svg(A.animalPlain(item.animal).replace(/^<svg[^>]*>|<\/svg>$/g, ''), 'b-q-art', '0 0 120 120', '一只小动物的图')}</div>`
        : `<button class="b-listen" data-action="say" data-text="${item.say}" data-fk="say" data-autofocus aria-label="再听一遍">${A.icons.speaker}<span>再听一遍</span></button>`;
      right = `<ul class="b-opts">${item.options.map((o) => `<li><button class="b-opt ${ui.optState(item, ans, o)}" lang="en" data-action="choose" data-opt="${o}" data-fk="opt-${o}" ${ans ? 'aria-disabled="true"' : ''}>${esc(o)}</button></li>`).join('')}</ul>`;
    }
    let fb = '';
    if (ans) {
      let btn = '';
      if (info.allDone) btn = '<button class="b-btn" data-action="finish" data-fk="finish-main" data-autofocus>完成这一关</button>';
      else if (!ans.correct) btn = '<button class="b-btn" data-action="next" data-fk="next" data-autofocus>下一题</button>';
      else if (q.idx !== firstOpen) btn = `<button class="b-btn" data-action="next" data-fk="next">回到第 ${firstOpen + 1} 题</button>`;
      fb = `<div class="b-fb ${ans.correct ? 'is-right' : 'is-wrong'}" id="b-fb">
        <span class="b-fb-stamp" aria-hidden="true">${ans.correct ? '对' : '再看看'}</span>
        <div role="status"><p class="b-fb-main">${ans.correct ? '答对了！' : `正确答案是 <b lang="en">${esc(item.answer)}</b>`}</p><p>${esc(item.explain)}</p></div>
        <button class="b-say" data-action="say" data-text="${item.answer}" data-fk="fb-say" aria-label="听正确答案">${A.icons.speaker}</button>
      </div>${btn}`;
    }
    return `<div class="b-desk b-desk-quiz">
      <header class="b-qhead">
        <button class="b-btn-line b-small" data-action="exitQuiz" data-fk="exit">退出</button>
        <p class="b-qwhere"><span lang="en">Unit ${unit.n}</span> 第 ${q.level.split('-l')[1]} 关</p>
        <button class="b-finish ${info.allDone ? '' : 'is-wait'}" data-action="finish" data-fk="finish" aria-describedby="b-nudge">${info.allDone ? '完成这一关' : `完成这一关（还差 ${info.left} 题）`}</button>
      </header>
      <div class="b-book b-book-quiz">
        <section class="b-page b-left b-qleft">
          <p class="b-qhint">${XY.TYPE_HINT[item.type]}</p>
          ${left}
        </section>
        <section class="b-page b-right b-qright">
          <ol class="b-prog" aria-label="第 ${info.n} 题，共 ${info.total} 题">${prog}</ol>
          <p id="b-nudge" class="b-nudge" role="alert">${esc(q.nudge || '')}</p>
          ${right}${fb}
        </section>
      </div></div>`;
  }

  // ---------- 结算 ----------
  function finish(s) {
    const r = s.result; const c = XY.child(s); const comp = XY.COMPANIONS[c.companion];
    const title = XY.UNITS.find((u) => u.key === r.unit.key).levels[r.levelN - 1];
    const spots = r.spots.map((sp, i) => `<li><button class="b-corner ${sp.open ? 'is-open' : ''}" data-action="hideout" data-i="${i}" data-fk="spot-${i}" ${sp.open ? 'aria-disabled="true"' : ''} aria-label="${sp.open ? (sp.found ? '找到了松果呀' : '这里是空的') : `掀开第 ${i + 1} 个藏匿点`}">
      ${sp.open ? (sp.found ? `${A.yahaha}<span>松果呀！<br>碎片 +1</span>` : '<span class="b-corner-empty">空的</span>') : '<span class="b-corner-fold" aria-hidden="true"></span><span>掀开</span>'}</button></li>`).join('');
    return `<div class="b-desk"><div class="b-book b-book-finish">
      <section class="b-page b-left b-done">
        ${r.passed ? `<div class="b-big-slot"><span class="b-sticker b-sticker-big is-new">${stickerArt(r.unit.key, r.levelN)}</span>${stamps(r.stars)}</div>
          <h1 class="b-title">贴上啦</h1><p class="b-done-sub"><span lang="en">Unit ${r.unit.n}</span> 第 ${r.levelN} 关，<span lang="en">${esc(title)}</span></p>`
        : `<div class="b-big-slot b-big-empty"><span class="b-slot-hole"><b>${r.levelN}</b></span></div><h1 class="b-title">还差一点点</h1>
          <p class="b-done-sub">答对 ${Math.ceil(r.S * 0.8)} 题就能贴上这张</p>`}
      </section>
      <section class="b-page b-right b-tally">
        <p class="b-tally-score">答对 <b>${r.C}</b> / ${r.S} 题${r.passed ? `，<b>${r.stars}</b> 星级` : ''}</p>
        ${r.passed ? `<dl class="b-ledger">
          <div><dt>${A.star(true, 'b-ic-star')}星星</dt><dd>+${r.awarded}</dd></div>
          <div><dt>${A.icons.fragment}碎片</dt><dd>+${r.fragments}</dd></div>
          <div><dt>${A.icons.paw}${esc(comp.name)}的经验</dt><dd>+${r.awarded}</dd></div>
        </dl>
        <h2 class="b-spots-title">藏匿点</h2><p class="b-spots-sub">掀开页角，看看有没有呀哈哈家族成员</p>
        <ul class="b-corners">${spots}</ul>` : ''}
        <div class="b-actions">${r.passed
          ? '<button class="b-btn" data-action="home" data-fk="home" data-autofocus>回到本子</button><button class="b-btn-line" data-action="again" data-fk="again">再玩一次</button>'
          : '<button class="b-btn" data-action="again" data-fk="again" data-autofocus>再玩一次</button><button class="b-btn-line" data-action="home" data-fk="home">回到本子</button>'}</div>
      </section>
    </div></div>`;
  }

  XY.variants.B = {
    name: '贴纸本',
    render(s) { return { wall, home, quiz, finish }[s.screen](s); },
    after(s) {
      if (s.screen === 'quiz' && XY.isCompact()) { const fb = document.getElementById('b-fb'); if (fb) fb.scrollIntoView({ block: 'nearest' }); }
    },
  };
})();
