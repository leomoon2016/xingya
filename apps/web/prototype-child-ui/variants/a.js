/* PROTOTYPE（用完即弃）方案 A「藤蔓小路」：地图优先。整门课程是一根连续生长的藤蔓，关卡是藤上的花苞。 */
(function () {
  const A = XYArt; const { esc, ui } = XY;
  const put = (s, x, y, w, h) => s.replace('<svg ', `<svg x="${x}" y="${y}" width="${w}" height="${h}" `);
  const potColors = ['#8CCB5E', '#FFC93C', '#7EC3E6'];

  // ---------- 头像墙 ----------
  function wall(s) {
    const picked = s.children.find((c) => c.id === s.picked);
    const pots = s.children.map((c, i) => {
      const locked = c.lockedUntil > XY.now();
      return `<li><button class="a-pot ${s.picked === c.id ? 'is-picked' : ''} ${locked ? 'is-locked' : ''}" data-action="pick" data-id="${c.id}" data-fk="pot-${c.id}" ${i === 0 && !s.picked ? 'data-autofocus' : ''} aria-label="${esc(c.name)}${locked ? '，已锁定' : ''}">
        ${A.svg(`<path d="M60 150 V96" stroke="#24734A" stroke-width="6" stroke-linecap="round"/>
          <path d="M60 124 q-26 -2 -32 -22 q24 -2 32 22Z" fill="#8CCB5E"/><path d="M60 116 q24 -6 30 -26 q-24 0 -30 26Z" fill="#6DB548"/>
          ${put(A.avatar(c.avatar), 20, 0, 80, 80)}
          <path d="M22 150 H98 L90 196 H30 Z" fill="${potColors[i]}"/><rect x="16" y="144" width="88" height="14" rx="5" fill="${potColors[i]}" stroke="#173A2A" stroke-opacity=".15" stroke-width="2"/>
          ${locked ? `<g transform="translate(76 4)"><circle cx="14" cy="14" r="15" fill="#6E4B2A"/>${put(A.icons.lock.replace('class="ic"', 'class="ic" color="#fff"'), 4, 4, 20, 20)}</g>` : ''}`, 'a-pot-art', '0 0 120 200')}
        <span class="a-pot-name">${esc(c.name)}</span>
      </button></li>`;
    }).join('');

    let side;
    if (!picked) {
      side = `<div class="a-pin-empty"><p>先点一点你的花盆</p></div>`;
    } else {
      const m = XY.pinMessage(picked);
      side = m.kind === 'locked'
        ? `<div class="a-pin-locked" role="alert">${A.icons.lock}<h2>${esc(picked.name)}的花盆锁上了</h2><p class="a-pin-msg">${m.text}</p><p class="a-pin-sub">${m.sub}</p>
             <button class="a-btn-quiet" data-action="unpick" data-fk="unpick" data-autofocus>换一个人</button></div>`
        : `<h2 class="a-pin-title">${esc(picked.name)}，输入你的 PIN</h2>
           ${ui.pinDots('a-dots', s.pin.length)}
           <p class="a-pin-msg ${m.kind === 'wrong' ? 'is-wrong' : ''}" role="${m.kind ? 'alert' : 'status'}">${m.kind === 'wrong' ? m.text : '4 位数字'}${m.sub ? `<span>${m.sub}</span>` : ''}</p>
           ${ui.keypad('a-keys')}
           <button class="a-btn-quiet" data-action="unpick" data-fk="unpick">不是我</button>`;
    }
    return `<main class="a-wall">
      <header class="a-wall-head"><h1>谁来学习？</h1><button class="a-link" data-action="parentEntry" data-fk="parent">家长入口</button></header>
      <div class="a-wall-body">
        <div class="a-sill-wrap"><ul class="a-sill">${pots}</ul></div>
        <section class="a-pin ${picked ? 'is-open' : ''} ${picked && XY.state.pinError.startsWith('wrong') ? 'is-shake' : ''}" aria-label="输入 PIN">${side}</section>
      </div></main>`;
  }

  // ---------- 主页：藤蔓地图 ----------
  function layout(view, compact) {
    const pts = []; let k = 0; let off = 0;
    view.forEach((u, ui_) => {
      if (ui_ > 0) off += compact ? 96 : 76;
      u.levels.forEach((l) => {
        const w = Math.sin(k * 0.95 + 0.6);
        pts.push(compact
          ? { x: 180 + w * 92, y: 130 + k * 96 + off, l, u }
          : { x: 110 + k * 112 + off, y: 250 + w * 82, l, u });
        k++;
      });
    });
    return pts;
  }
  function seg(p, i) { // Catmull-Rom → 三次贝塞尔：第 i 段（p[i] → p[i+1]）
    const p0 = p[i - 1] || p[i]; const p1 = p[i]; const p2 = p[i + 1]; const p3 = p[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6; const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6; const c2y = p2.y - (p3.y - p1.y) / 6;
    return `C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  function node(p, c, comp, compact) {
    const { l, u } = p;
    const label = `Unit ${u.n} 第 ${l.n} 关，${l.status === 'done' ? `${l.best} 星级` : l.status === 'current' ? '现在学这一关' : '还没解锁'}`;
    const act = l.status === 'locked' ? 'data-action="lockedLevel"' : `data-action="play" data-level="${l.id}"`;
    const stars = [1, 2, 3].map((n) => `<polygon class="${n <= l.best ? 'a-st-on' : 'a-st-off'}" transform="translate(${(n - 2) * 17 - 7} 30) scale(.6)" points="12,2 15,9 22.5,9.3 16.6,14 18.7,21.5 12,17.3 5.3,21.5 7.4,14 1.5,9.3 9,9"/>`).join('');
    let body;
    if (l.status === 'done') {
      body = `${[0, 1, 2, 3, 4].map((a) => `<circle class="a-petal" cx="${(Math.cos(a * 1.2566 - 1.5708) * 15).toFixed(1)}" cy="${(Math.sin(a * 1.2566 - 1.5708) * 15).toFixed(1)}" r="12"/>`).join('')}
        <circle class="a-core" r="12"/><text class="a-num" y="5">${l.n}</text>${stars}`;
    } else if (l.status === 'current') {
      body = `<circle class="a-halo" r="44"/><circle class="a-bud" r="34"/><text class="a-num a-num-big" y="9">${l.n}</text>
        ${compact ? put(A.companion(comp, 'idle'), p.x > 180 ? -128 : 46, -50, 78, 80) : put(A.companion(comp, 'idle'), 24, -112, 78, 80)}`;
    } else {
      body = `<ellipse class="a-seed" rx="15" ry="19"/><text class="a-num a-num-seed" y="5">${l.n}</text>`;
    }
    return `<g class="a-node is-${l.status}" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})" role="button" tabindex="0" ${act} data-fk="node-${l.id}" aria-label="${label}">
      <circle class="a-hit" r="30"/><circle class="focus-ring" r="${l.status === 'current' ? 48 : 30}"/>${body}</g>`;
  }
  function home(s) {
    const c = XY.child(s); const comp = XY.COMPANIONS[c.companion];
    const view = XY.courseView(c); const cur = XY.currentLevel(view);
    const compact = XY.isCompact();
    const pts = layout(view, compact);
    const ci = cur ? pts.findIndex((p) => p.l.id === cur.level.id) : pts.length - 1;
    const segs = pts.slice(0, -1).map((_, i) => seg(pts, i));
    const start = `M${pts[0].x} ${pts[0].y}`;
    const grownTo = Math.max(0, ci);
    const growing = Boolean(s.lastGrown && grownTo > 0);
    const grown = start + segs.slice(0, growing ? grownTo - 1 : grownTo).join('');
    const lastSeg = growing ? `M${pts[grownTo - 1].x} ${pts[grownTo - 1].y}${segs[grownTo - 1]}` : '';
    const firstOfUnit = view.map((u) => pts.find((p) => p.u.key === u.key));
    const signs = firstOfUnit.map((p, i) => {
      const u = view[i];
      const x = compact ? 28 : p.x - 40; const y = compact ? p.y - 70 : 52;
      return `<g class="a-sign ${u.unlocked ? '' : 'is-locked'}" transform="translate(${x} ${y})"><text class="a-sign-en">Unit ${u.n} ${esc(u.en)}</text><text class="a-sign-cn" y="24">${esc(u.cn)}${u.unlocked ? `　已过 ${u.passed}/${u.levels.length}` : '　未解锁'}</text></g>`;
    }).join('');
    const W = compact ? 360 : pts[pts.length - 1].x + 120;
    const H = compact ? pts[pts.length - 1].y + 80 : 440;
    return `<div class="a-home">
      <header class="a-hud">
        <div class="a-who">${A.avatar(c.avatar, 'a-hud-av')}<span>${esc(c.name)}</span><button class="a-btn-quiet a-small" data-action="switchChild" data-fk="switch">换人</button></div>
        <p class="a-course">一年级上册</p>
        <div class="a-hud-right">
          <span class="a-stars" aria-label="星星 ${c.stars} 颗">${A.star(true, 'a-star-ic')}${c.stars}</span>
          <button class="a-review" data-action="review" data-fk="review">${A.icons.review}复习 <b>${c.reviewDue}</b></button>
        </div>
      </header>
      <main class="a-map" id="a-map" aria-label="一年级上册的关卡藤蔓">
        <svg class="a-vine" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
          ${signs}
          <path class="a-path-all" d="${start}${segs.join('')}"/>
          <path class="a-path-grown" d="${grown}"/>
          ${lastSeg ? `<path class="a-path-grown a-grow" id="a-grow" d="${lastSeg}"/>` : ''}
          ${pts.map((p) => node(p, c, comp, compact)).join('')}
        </svg>
      </main>
      ${cur ? `<footer class="a-dock">
        <div class="a-dock-text"><p class="a-dock-where">Unit ${cur.unit.n} ${esc(cur.unit.en)}　第 ${cur.level.n} 关</p><p class="a-dock-words" lang="en">${esc(cur.level.title)}</p></div>
        <button class="a-btn" data-action="play" data-level="${cur.level.id}" data-fk="start" data-autofocus>开始第 ${cur.level.n} 关</button>
      </footer>` : ''}
    </div>`;
  }

  // ---------- 闯关 ----------
  function quiz(s) {
    const q = s.quiz; const info = ui.qinfo(q); const { item, ans } = info;
    const firstOpen = q.qs.findIndex((_, i) => !q.answers[i]);
    const leaves = q.qs.map((_, i) => {
      const a = q.answers[i];
      const st = a ? (a.correct ? 'is-right' : 'is-wrong') : i === firstOpen ? 'is-now' : '';
      const can = a || i === firstOpen;
      return `<li><button class="a-qleaf ${st} ${i === q.idx ? 'is-here' : ''}" data-action="goto" data-i="${i}" data-fk="leaf-${i}" ${can ? '' : 'disabled'} aria-label="第 ${i + 1} 题${a ? (a.correct ? '，答对了' : '，答错了') : ''}${i === q.idx ? '，正在看' : ''}">
        ${A.svg('<path d="M4 20 q10 -18 28 -16 q0 18 -28 16Z"/>', '', '0 0 36 24')}</button></li>`;
    }).join('');
    let stage; let answers;
    if (item.type === 'order') {
      const placed = q.picked.map((k) => item.tiles[k]);
      const show = ans ? ans.response.split(' ') : placed.map((t) => t.t);
      stage = `<div class="a-order-pic">${A.animalPlain(item.animal, 'a-pic a-pic-sm')}
          <button class="a-say" data-action="say" data-text="${item.answer}" data-fk="say" aria-label="听这句话">${A.icons.speaker}</button></div>
        <div class="a-slots ${ans ? (ans.correct ? 'is-right' : 'is-wrong') : ''}" aria-label="排好的句子">${item.tiles.map((_, i) => (show[i]
          ? `<button class="a-tile is-placed" lang="en" ${ans ? 'disabled' : `data-action="untile" data-i="${q.picked[i]}" data-fk="slot-${i}"`}>${esc(show[i])}</button>`
          : '<span class="a-slot"></span>')).join('')}</div>`;
      answers = ans ? '' : `<div class="a-tiles">${item.tiles.map((t, i) => (q.picked.includes(i)
        ? '<span class="a-tile is-ghost" aria-hidden="true"></span>'
        : `<button class="a-tile" lang="en" data-action="tile" data-i="${i}" data-fk="tile-${i}">${esc(t.t)}</button>`)).join('')}</div>
        <button class="a-btn" data-action="checkOrder" data-fk="check" ${q.picked.length < item.tiles.length ? 'disabled' : ''}>排好了</button>`;
    } else {
      stage = item.type === 'pick_image'
        ? `<div class="a-pic-wrap">${A.svg(A.animalPlain(item.animal).replace(/^<svg[^>]*>|<\/svg>$/g, ''), 'a-pic', '0 0 120 120', '一只小动物的图')}</div>`
        : `<button class="a-listen" data-action="say" data-text="${item.say}" data-fk="say" data-autofocus aria-label="再听一遍">${A.icons.speaker}<span>再听一遍</span></button>`;
      answers = `<div class="a-opts">${item.options.map((o) => `<button class="a-opt ${ui.optState(item, ans, o)}" lang="en" data-action="choose" data-opt="${o}" data-fk="opt-${o}" ${ans ? 'aria-disabled="true"' : ''}>${esc(o)}</button>`).join('')}</div>`;
    }
    let fb = '';
    if (ans) {
      let btn = '';
      if (info.allDone) btn = `<button class="a-btn" data-action="finish" data-fk="finish-main" data-autofocus>完成这一关</button>`;
      else if (!ans.correct) btn = `<button class="a-btn" data-action="next" data-fk="next" data-autofocus>下一题</button>`;
      else if (q.idx !== firstOpen) btn = `<button class="a-btn" data-action="next" data-fk="next">回到第 ${firstOpen + 1} 题</button>`;
      fb = `<div class="a-fb ${ans.correct ? 'is-right' : 'is-wrong'}" id="a-fb">
        <button class="a-say a-say-sm" data-action="say" data-text="${item.answer}" data-fk="fb-say" aria-label="听正确答案">${A.icons.speaker}</button>
        <div class="a-fb-text" role="status">${ans.correct ? '<p>答对了！</p>' : `<p>正确答案是 <b lang="en">${esc(item.answer)}</b></p>`}<p class="a-fb-sub">${esc(item.explain)}</p></div>
        ${btn}</div>`;
    }
    const unit = XY.UNITS.find((u) => q.level.startsWith(u.key));
    return `<div class="a-quiz">
      <header class="a-qbar">
        <button class="a-icon-btn" data-action="exitQuiz" data-fk="exit" aria-label="退出这一关">${A.icons.close}</button>
        <div class="a-qtrack"><p class="a-qwhere">Unit ${unit.n} 第 ${q.level.split('-l')[1]} 关　第 ${info.n}/${info.total} 题</p><ol class="a-qleaves">${leaves}</ol></div>
        <button class="a-finish-btn ${info.allDone ? '' : 'is-wait'}" data-action="finish" data-fk="finish" aria-describedby="a-nudge">${info.allDone ? '完成这一关' : `还差 ${info.left} 题`}</button>
      </header>
      <p id="a-nudge" class="a-nudge" role="alert">${esc(q.nudge || '')}</p>
      <main class="a-stage">
        <p class="a-hint">${XY.TYPE_HINT[item.type]}</p>
        ${stage}
      </main>
      <footer class="a-answer-row">${answers}${fb}</footer>
    </div>`;
  }

  // ---------- 结算 ----------
  function finish(s) {
    const r = s.result; const c = XY.child(s); const comp = XY.COMPANIONS[c.companion];
    const petals = [-90, 30, 150].map((deg, i) => {
      const x = (Math.cos(deg * Math.PI / 180) * 60).toFixed(1); const y = (Math.sin(deg * Math.PI / 180) * 60).toFixed(1);
      return `<g transform="translate(${x} ${y})"><g class="a-fl-pop"><polygon class="${i < r.stars ? 'a-fl-on' : 'a-fl-off'}" transform="translate(-30 -30) scale(2.5)" points="12,2 15,9 22.5,9.3 16.6,14 18.7,21.5 12,17.3 5.3,21.5 7.4,14 1.5,9.3 9,9"/></g></g>`;
    }).join('');
    const spots = r.spots.map((sp, i) => `<li><button class="a-spot ${sp.open ? 'is-open' : ''}" data-action="hideout" data-i="${i}" data-fk="spot-${i}" ${sp.open ? 'aria-disabled="true"' : ''} aria-label="${sp.open ? (sp.found ? '找到了松果呀' : '这里只有叶子') : `翻开第 ${i + 1} 个藏匿点`}">
        ${sp.open ? (sp.found ? `${A.yahaha}<span>松果呀！<br>碎片 +1</span>` : `${A.svg('<path d="M10 40 q20 -30 40 0 q-20 10 -40 0Z" fill="#8CCB5E"/><path d="M30 44 q20 -30 40 0 q-20 10 -40 0Z" fill="#6DB548"/>', '', '0 0 80 56')}<span>只有叶子</span>`)
          : `${A.svg('<path d="M6 44 q14 -34 34 -10 q16 -26 34 4 q-6 10 -34 10 q-26 4 -34 -4Z" fill="#6DB548"/><path d="M20 40 q14 -20 26 -4 q10 -14 22 2" stroke="#24734A" stroke-width="3" fill="none"/>', '', '0 0 80 56')}<span>翻开</span>`}
      </button></li>`).join('');
    return `<main class="a-finish">
      <div class="a-bloom ${r.passed ? 'is-pass' : ''}">
        ${A.svg(`<g transform="translate(110 110)"><circle r="96" class="a-bloom-bg"/>${petals}<path class="a-bloom-stem" d="M0 20 V92"/><path class="a-bloom-leaf" d="M0 66 q-26 -4 -32 -24 q24 0 32 24Z"/><path class="a-bloom-leaf" d="M0 56 q24 -8 30 -28 q-24 2 -30 28Z"/><circle r="26" class="a-bloom-core"/></g>`, 'a-bloom-art', '0 0 220 220', `${r.stars} 星级`)}
        ${A.companion(comp, r.passed ? 'cheer' : 'think', 'a-bloom-comp')}
      </div>
      <div class="a-finish-text">
        <h1>${r.passed ? `Unit ${r.unit.n} 第 ${r.levelN} 关完成啦` : '差一点点就过关了'}</h1>
        <p class="a-finish-sub">答对 ${r.C} / ${r.S} 题${r.passed ? `，得到 ${r.stars} 星级` : `，答对 ${Math.ceil(r.S * 0.8)} 题就能过关`}</p>
        ${r.passed ? `<ul class="a-rewards">
          <li>${A.star(true, 'a-rw-ic')}<b>+${r.awarded}</b><span>星星</span></li>
          <li>${A.icons.fragment}<b>+${r.fragments}</b><span>碎片</span></li>
          <li>${A.icons.paw}<b>+${r.awarded}</b><span>${esc(comp.name)}的经验</span></li>
        </ul>
        <h2 class="a-spots-title">藏匿点</h2>
        <p class="a-spots-sub">翻开叶子堆，看看有没有呀哈哈家族成员</p>
        <ul class="a-spots">${spots}</ul>` : ''}
        <div class="a-finish-actions">
          ${r.passed ? '<button class="a-btn" data-action="home" data-fk="home" data-autofocus>回到藤蔓</button><button class="a-btn-quiet" data-action="again" data-fk="again">再玩一次</button>'
            : '<button class="a-btn" data-action="again" data-fk="again" data-autofocus>再玩一次</button><button class="a-btn-quiet" data-action="home" data-fk="home">回到藤蔓</button>'}
        </div>
      </div>
    </main>`;
  }

  XY.variants.A = {
    name: '藤蔓小路',
    keepScroll: true,
    render(s) { return { wall, home, quiz, finish }[s.screen](s); },
    after(s, { screenChanged }) {
      if (s.screen === 'quiz' && XY.isCompact()) { const fb = document.getElementById('a-fb'); if (fb) fb.scrollIntoView({ block: 'nearest' }); }
      if (s.screen !== 'home') { if (screenChanged) window.scrollTo(0, 0); return; }
      const cur = document.querySelector('.a-node.is-current') || document.querySelector('.a-node:last-of-type');
      if (screenChanged && cur) {
        const map = document.getElementById('a-map');
        if (XY.isCompact()) {
          const r = cur.getBoundingClientRect(); window.scrollTo(0, Math.max(0, r.top + window.scrollY - window.innerHeight * 0.45));
        } else {
          const r = cur.getBoundingClientRect(); const m = map.getBoundingClientRect();
          map.scrollLeft = Math.max(0, map.scrollLeft + r.left - m.left - m.width * 0.55);
        }
      }
      const g = document.getElementById('a-grow');
      if (g && screenChanged) {
        const len = g.getTotalLength();
        g.style.strokeDasharray = `${len}`; g.style.strokeDashoffset = `${len}`;
        requestAnimationFrame(() => requestAnimationFrame(() => { g.classList.add('is-going'); g.style.strokeDashoffset = '0'; }));
        XY.state.lastGrown = null;
      }
    },
  };
})();
