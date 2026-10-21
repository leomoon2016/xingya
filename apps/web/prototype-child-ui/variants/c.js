/* PROTOTYPE（用完即弃）方案 C「伙伴小岛」：伙伴优先。跟随伙伴站在正中用一句话带路；单元是小岛，一次只看一座；答题也由伙伴来问、来反应。 */
(function () {
  const A = XYArt; const { esc, ui } = XY;
  const island = (cls = '') => A.svg('<ellipse cx="100" cy="30" rx="98" ry="22" fill="#3FB8C6" opacity=".55"/><path d="M14 26 C30 6 170 6 186 26 C170 40 30 40 14 26Z" fill="#FFE3A3"/><path d="M40 18 q6 -10 14 0 M140 16 q6 -8 12 0" stroke="#E9C77A" stroke-width="3" fill="none" stroke-linecap="round"/>', `c-island ${cls}`, '0 0 200 52');
  const bigStar = (on, cls = '') => A.svg('<polygon points="50,6 62,36 94,37 69,57 78,89 50,71 22,89 31,57 6,37 38,36" stroke-linejoin="round"/>', `${cls} ${on ? 'is-on' : 'is-off'}`, '0 0 100 96');

  // ---------- 头像墙 ----------
  function wall(s) {
    const picked = s.children.find((c) => c.id === s.picked);
    if (!picked) {
      const items = s.children.map((c, i) => {
        const locked = c.lockedUntil > XY.now(); const comp = XY.COMPANIONS[c.companion];
        return `<li><button class="c-kid ${locked ? 'is-locked' : ''}" data-action="pick" data-id="${c.id}" data-fk="kid-${c.id}" ${i === 0 ? 'data-autofocus' : ''} aria-label="${esc(c.name)}${locked ? '，已锁定' : ''}">
          <span class="c-kid-pair">${A.avatar(c.avatar, 'c-kid-av')}${A.companion(comp, locked ? 'think' : 'idle', 'c-kid-pal')}</span>
          ${island()}
          <span class="c-kid-name">${esc(c.name)}${locked ? `<span class="c-kid-lock">${A.icons.lock}锁住了</span>` : ''}</span>
        </button></li>`;
      }).join('');
      return `<main class="c-sky c-wall">
        <header class="c-wall-head"><h1>谁来学习？</h1><button class="c-link" data-action="parentEntry" data-fk="parent">家长入口</button></header>
        <ul class="c-kids">${items}</ul>
      </main>`;
    }
    const comp = XY.COMPANIONS[picked.companion]; const m = XY.pinMessage(picked); const locked = m.kind === 'locked';
    return `<main class="c-sky c-wall c-wall-focus">
      <header class="c-wall-head"><button class="c-ghost" data-action="unpick" data-fk="unpick" ${locked ? 'data-autofocus' : ''}>${A.icons.back}换人</button></header>
      <div class="c-focus">
        <div class="c-focus-who">
          <div class="c-bubble c-bubble-say ${locked ? 'is-alert' : ''}" role="${m.kind ? 'alert' : 'status'}">
            ${locked ? `<p class="c-say-main">${m.text}</p><p class="c-say-sub">${m.sub}</p>`
              : m.kind === 'wrong' ? `<p class="c-say-main">${m.text}</p><p class="c-say-sub">${m.sub}</p>`
                : `<p class="c-say-main">${esc(picked.name)}，输入 PIN，我带你进去</p>`}
          </div>
          <span class="c-focus-pair">${A.avatar(picked.avatar, 'c-focus-av')}${A.companion(comp, locked || m.kind === 'wrong' ? 'think' : 'happy', 'c-focus-pal')}</span>
          ${island('c-island-big')}
        </div>
        ${locked ? '' : `<div class="c-pin ${m.kind === 'wrong' ? 'is-shake' : ''}">
          <div class="c-pin-stars" aria-label="已输入 ${s.pin.length} 位，共 4 位">${[0, 1, 2, 3].map((i) => bigStar(i < s.pin.length, 'c-pin-star')).join('')}</div>
          ${ui.keypad('c-keys')}
        </div>`}
      </div>
    </main>`;
  }

  // ---------- 主页 ----------
  function home(s) {
    const c = XY.child(s); const comp = XY.COMPANIONS[c.companion];
    const view = XY.courseView(c); const cur = XY.currentLevel(view);
    const shownIdx = Math.max(0, view.findIndex((u) => u.key === (s.viewUnit || (cur ? cur.unit.key : view[view.length - 1].key))));
    const u = view[shownIdx]; const prev = view[shownIdx - 1]; const next = view[shownIdx + 1];
    const stones = u.levels.map((l) => {
      const label = `第 ${l.n} 关，${l.status === 'done' ? `${l.best} 星级` : l.status === 'current' ? '现在学这一关' : '还没解锁'}`;
      const act = l.status === 'locked' ? 'data-action="lockedLevel"' : `data-action="play" data-level="${l.id}"`;
      return `<li><button class="c-stone is-${l.status}" ${act} data-fk="stone-${l.id}" aria-label="${label}">
        <span class="c-stone-n">${l.n}</span>
        ${l.status === 'done' ? `<span class="c-stone-stars">${[1, 2, 3].map((n) => A.star(n <= l.best, 'c-mini-star')).join('')}</span>` : ''}
        ${l.status === 'locked' ? A.icons.lock : ''}
      </button></li>`;
    }).join('');
    const ratio = c.exp / c.expNext;
    return `<div class="c-sky c-home">
      <header class="c-top">
        <div class="c-who">${A.avatar(c.avatar, 'c-who-av')}<span>${esc(c.name)}</span><button class="c-ghost c-small" data-action="switchChild" data-fk="switch">换人</button></div>
        <p class="c-course">一年级上册</p>
        <p class="c-bank"><span>${A.star(true, 'c-bank-ic')}<b>${c.stars}</b><span class="xy-sr">颗星星</span></span><span>${A.icons.fragment}<b>${c.fragments}</b><span class="xy-sr">片碎片</span></span></p>
      </header>
      <main class="c-main">
        <section class="c-pal-zone" aria-label="${esc(comp.name)}说">
          <div class="c-bubble c-bubble-home">
            ${cur ? `<p class="c-say-main">今天去第 ${cur.level.n} 关吧！</p>
              <p class="c-say-sub"><span lang="en">Unit ${cur.unit.n} ${esc(cur.unit.en)}</span>，我们来学 <span lang="en">${esc(cur.level.title)}</span></p>
              <div class="c-bubble-actions">
                <button class="c-btn" data-action="play" data-level="${cur.level.id}" data-fk="go" data-autofocus>出发</button>
                <button class="c-btn-soft" data-action="review" data-fk="review">先复习 ${c.reviewDue} 个词</button>
              </div>` : '<p class="c-say-main">这本书全部过关啦！</p>'}
          </div>
          <div class="c-pal-stand">${A.companion(comp, 'happy', 'c-pal-big')}${island('c-island-big')}</div>
          <p class="c-pal-name"><b>${esc(comp.name)}</b>（${esc(comp.stageName)}）<span class="c-exp" role="img" aria-label="经验 ${c.exp} / ${c.expNext}"><span class="c-exp-bar c-exp-${Math.round(ratio * 10)}"></span></span></p>
        </section>
        <section class="c-unit-zone" aria-label="单元小岛">
          <div class="c-unit-nav">
            ${prev ? `<button class="c-round" data-action="viewUnit" data-key="${prev.key}" data-fk="prev-unit" aria-label="上一个单元：Unit ${prev.n}">${A.icons.back}</button>` : '<span class="c-round-gap"></span>'}
            <h2><span lang="en">Unit ${u.n} ${esc(u.en)}</span><span class="c-unit-cn">${esc(u.cn)}</span></h2>
            ${next ? `<button class="c-round" data-action="viewUnit" data-key="${next.key}" data-fk="next-unit" aria-label="下一个单元：Unit ${next.n}">${A.icons.next}</button>` : '<span class="c-round-gap"></span>'}
          </div>
          <div class="c-unit-island ${u.unlocked ? '' : 'is-fog'}">
            <ol class="c-stones">${stones}</ol>
          </div>
          <p class="c-unit-note">${u.unlocked ? `已过 ${u.passed} / ${u.levels.length} 关` : `完成 Unit ${u.n - 1} 才能去这座岛`}</p>
          <ol class="c-unit-dots" aria-hidden="true">${view.map((x, i) => `<li class="${i === shownIdx ? 'is-on' : ''} ${x.done ? 'is-done' : ''}"></li>`).join('')}</ol>
        </section>
      </main>
    </div>`;
  }

  // ---------- 闯关 ----------
  function quiz(s) {
    const q = s.quiz; const info = ui.qinfo(q); const { item, ans } = info;
    const c = XY.child(s); const comp = XY.COMPANIONS[c.companion];
    const firstOpen = q.qs.findIndex((_, i) => !q.answers[i]);
    const prog = q.qs.map((_, i) => {
      const a = q.answers[i]; const can = a || i === firstOpen;
      return `<li><button class="c-pstar ${a ? (a.correct ? 'is-right' : 'is-wrong') : ''} ${i === q.idx ? 'is-here' : ''}" data-action="goto" data-i="${i}" data-fk="p-${i}" ${can ? '' : 'disabled'} aria-label="第 ${i + 1} 题${a ? (a.correct ? '，答对了' : '，答错了') : ''}">${bigStar(a && a.correct, 'c-pstar-art')}</button></li>`;
    }).join('');
    const mood = !ans ? 'idle' : ans.correct ? 'happy' : 'think';
    let ask = ''; let pick = '';
    let btn = '';
    if (ans) {
      if (info.allDone) btn = '<button class="c-btn" data-action="finish" data-fk="finish-main" data-autofocus>完成这一关</button>';
      else if (!ans.correct) btn = '<button class="c-btn" data-action="next" data-fk="next" data-autofocus>下一题</button>';
      else if (q.idx !== firstOpen) btn = `<button class="c-btn" data-action="next" data-fk="next">回到第 ${firstOpen + 1} 题</button>`;
    }
    const sayBtn = (text, label, fk) => `<button class="c-say" data-action="say" data-text="${text}" data-fk="${fk}" aria-label="${label}">${A.icons.speaker}</button>`;
    if (ans) {
      ask = `<p class="c-say-main" role="status">${ans.correct ? '答对了！' : `是 <b lang="en">${esc(item.answer)}</b> 哦`}</p><p class="c-say-sub">${esc(item.explain)}</p>
        <div class="c-bubble-actions">${sayBtn(item.answer, '听正确答案', 'fb-say')}${btn}</div>`;
    } else if (item.type === 'pick_image') {
      ask = `<p class="c-say-main">这是什么？</p><p class="c-say-sub">${XY.TYPE_HINT[item.type]}</p>${A.svg(A.animalPlain(item.animal).replace(/^<svg[^>]*>|<\/svg>$/g, ''), 'c-q-art', '0 0 120 120', '一只小动物的图')}`;
    } else if (item.type === 'listen_choose') {
      ask = `<p class="c-say-main">听我说</p><p class="c-say-sub">${XY.TYPE_HINT[item.type]}</p><button class="c-listen" data-action="say" data-text="${item.say}" data-fk="say" data-autofocus>${A.icons.speaker}<span>再听一遍</span></button>`;
    } else {
      ask = `<p class="c-say-main">帮我把这句话排好</p><p class="c-say-sub">${XY.TYPE_HINT[item.type]}</p><div class="c-q-row">${A.animalPlain(item.animal, 'c-q-art c-q-art-sm')}${sayBtn(item.answer, '听这句话', 'say')}</div>`;
    }
    if (item.type === 'order') {
      const show = ans ? ans.response.split(' ') : q.picked.map((k) => item.tiles[k].t);
      pick = `<div class="c-sentence ${ans ? (ans.correct ? 'is-right' : 'is-wrong') : ''}" aria-label="排好的句子">${item.tiles.map((_, i) => (show[i]
        ? `<button class="c-chip is-placed" lang="en" ${ans ? 'disabled' : `data-action="untile" data-i="${q.picked[i]}" data-fk="slot-${i}"`}>${esc(show[i])}</button>`
        : '<span class="c-chip-gap"></span>')).join('')}</div>
        ${ans ? '' : `<div class="c-chips">${item.tiles.map((t, i) => (q.picked.includes(i) ? '' : `<button class="c-chip" lang="en" data-action="tile" data-i="${i}" data-fk="tile-${i}">${esc(t.t)}</button>`)).join('')}</div>
        <button class="c-btn" data-action="checkOrder" data-fk="check" ${q.picked.length < item.tiles.length ? 'disabled' : ''}>排好了</button>`}`;
    } else {
      pick = `<ul class="c-bubbles">${item.options.map((o) => `<li><button class="c-pop ${ui.optState(item, ans, o)}" lang="en" data-action="choose" data-opt="${o}" data-fk="opt-${o}" ${ans ? 'aria-disabled="true"' : ''}>${esc(o)}</button></li>`).join('')}</ul>`;
    }
    return `<div class="c-sky c-quiz">
      <header class="c-qtop">
        <button class="c-round" data-action="exitQuiz" data-fk="exit" aria-label="退出这一关">${A.icons.close}</button>
        <ol class="c-prog" aria-label="第 ${info.n} 题，共 ${info.total} 题">${prog}</ol>
        <button class="c-finish ${info.allDone ? '' : 'is-wait'}" data-action="finish" data-fk="finish" aria-describedby="c-nudge">${info.allDone ? '完成这一关' : `还差 ${info.left} 题`}</button>
      </header>
      <p id="c-nudge" class="c-nudge" role="alert">${esc(q.nudge || '')}</p>
      <main class="c-qmain">
        <section class="c-asker">
          <div class="c-bubble c-bubble-ask" id="c-ask">${ask}</div>
          <div class="c-asker-pal ${ans && ans.correct ? 'is-hop' : ''}">${A.companion(comp, mood, 'c-asker-art')}</div>
        </section>
        <section class="c-answer">${pick}</section>
      </main>
    </div>`;
  }

  // ---------- 结算 ----------
  function finish(s) {
    const r = s.result; const c = XY.child(s); const comp = XY.COMPANIONS[c.companion];
    const spots = r.spots.map((sp, i) => `<li><button class="c-mound ${sp.open ? 'is-open' : ''}" data-action="hideout" data-i="${i}" data-fk="spot-${i}" ${sp.open ? 'aria-disabled="true"' : ''} aria-label="${sp.open ? (sp.found ? '找到了松果呀' : '这里只有沙子') : `挖开第 ${i + 1} 个藏匿点`}">
      ${sp.open ? (sp.found ? `${A.yahaha}<span>松果呀！<br>碎片 +1</span>` : '<span>只有沙子</span>')
        : `${A.svg('<path d="M6 46 C16 14 64 14 74 46Z" fill="#FFE3A3"/><path d="M26 30 q6 -6 12 0" stroke="#E9C77A" stroke-width="3" fill="none"/>', 'c-mound-art', '0 0 80 50')}<span>挖开</span>`}</button></li>`).join('');
    return `<main class="c-sky c-end">
      <div class="c-stars-arc" role="img" aria-label="${r.stars} 星级">${[0, 1, 2].map((i) => bigStar(i < r.stars, `c-arc-star c-arc-${i}`)).join('')}</div>
      <div class="c-finish-row">
        <div class="c-finish-pal">${A.companion(comp, r.passed ? 'cheer' : 'think', 'c-pal-big')}${island('c-island-big')}</div>
        <div class="c-bubble c-bubble-finish">
          <p class="c-say-main">${r.passed ? `我们拿到 ${r.stars} 星级啦！` : '差一点点，再来一次吧'}</p>
          <p class="c-say-sub">Unit ${r.unit.n} 第 ${r.levelN} 关，答对 ${r.C} / ${r.S} 题${r.passed ? '' : `，答对 ${Math.ceil(r.S * 0.8)} 题就能过关`}</p>
          ${r.passed ? `<ul class="c-gains">
            <li>${A.star(true, 'c-bank-ic')}<span>星星</span><b>+${r.awarded}</b></li>
            <li>${A.icons.fragment}<span>碎片</span><b>+${r.fragments}</b></li>
            <li>${A.icons.paw}<span>${esc(comp.name)}的经验</span><b>+${r.awarded}</b></li></ul>` : ''}
          <div class="c-bubble-actions">${r.passed
            ? '<button class="c-btn" data-action="home" data-fk="home" data-autofocus>回到小岛</button><button class="c-btn-soft" data-action="again" data-fk="again">再玩一次</button>'
            : '<button class="c-btn" data-action="again" data-fk="again" data-autofocus>再玩一次</button><button class="c-btn-soft" data-action="home" data-fk="home">回到小岛</button>'}</div>
        </div>
      </div>
      ${r.passed ? `<section class="c-spots" aria-label="藏匿点"><h2>藏匿点</h2><p>挖开沙堆，看看有没有呀哈哈家族成员</p><ul>${spots}</ul></section>` : ''}
    </main>`;
  }

  XY.variants.C = {
    name: '伙伴小岛',
    render(s) { return { wall, home, quiz, finish }[s.screen](s); },
    after(s) {
      if (s.screen === 'quiz' && XY.isCompact() && s.quiz.answers[s.quiz.idx]) { const el = document.getElementById('c-ask'); if (el) el.scrollIntoView({ block: 'nearest' }); }
    },
  };
})();
