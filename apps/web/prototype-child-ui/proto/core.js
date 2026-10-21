/* PROTOTYPE（用完即弃）：孩子端原型的共享数据、内存状态与动作。
   问题：孩子端长什么样？三套方案只换渲染（variants/*.js），数据与规则共用这一份。
   规则按 docs/01-requirements/modules/learning.md §4.1.2–4.1.5 与 family.md（PIN 5 次错锁 15 分钟）简化实现。 */
(function () {
  const MIN = 60 * 1000;
  const now = () => Date.now();

  // ---------- 内容：一年级上册（en-g1-a）----------
  const UNITS = [
    { key: 'u01', n: 1, en: 'Hello', cn: '你好', levels: ['Hi!', 'Good morning', 'My name is…', 'Goodbye'] },
    { key: 'u02', n: 2, en: 'Colours', cn: '颜色', levels: ['red, blue', 'yellow, green', 'What colour?', 'Rainbow'] },
    { key: 'u03', n: 3, en: 'Animals', cn: '动物', levels: ['cat, dog', 'duck, fish', 'bird, rabbit', 'I see a…', 'Animal party'], animals: ['cat', 'dog', 'duck', 'fish', 'bird', 'rabbit'] },
    { key: 'u04', n: 4, en: 'Food', cn: '食物', levels: ['apple, egg', 'milk, rice', 'I like…', 'Picnic'] },
    { key: 'u05', n: 5, en: 'Toys', cn: '玩具', levels: ['ball, doll', 'kite, car', 'My toys', 'Toy box'] },
  ];
  const levelId = (u, i) => `${u.key}-l${i + 1}`;

  // Unit 3 闯关题（真实一年级内容；1–2 年级不出拼写题，见 learning §4.1.3）。
  const QUESTIONS = [
    { type: 'pick_image', animal: 'cat', options: ['cat', 'dog', 'duck'], answer: 'cat', explain: 'cat 是猫。' },
    { type: 'listen_choose', say: 'fish', options: ['fish', 'bird', 'rabbit'], answer: 'fish', explain: '你听到的是 fish，鱼。' },
    { type: 'pick_image', animal: 'rabbit', options: ['bird', 'rabbit', 'fish'], answer: 'rabbit', explain: 'rabbit 是兔子。' },
    { type: 'listen_choose', say: 'dog', options: ['duck', 'dog', 'cat'], answer: 'dog', explain: '你听到的是 dog，狗。' },
    { type: 'pick_image', animal: 'bird', options: ['bird', 'duck', 'dog'], answer: 'bird', explain: 'bird 是小鸟。' },
    { type: 'order', animal: 'duck', tiles: ['This', 'is', 'a', 'duck.'], answer: 'This is a duck.', explain: '这是一只鸭子：This is a duck.' },
  ];
  const TYPE_HINT = {
    pick_image: '看图，选出它的英文',
    listen_choose: '听一听，选出你听到的词',
    order: '听一听，把词块排成一句话',
  };

  const COMPANIONS = {
    tuantuan: { name: '团团', color: '#7CC8A0', belly: '#D9F2E3', sprout: 'leaf', stage: 2, stageName: '小苗' },
    gulu: { name: '咕噜', color: '#F7A86B', belly: '#FDE3CC', sprout: 'star', stage: 1, stageName: '种子' },
    momo: { name: '墨墨', color: '#9AA6F0', belly: '#E2E6FF', sprout: 'leaf', stage: 1, stageName: '种子' },
  };

  function makeProgress(bestByUnit) { // {u01:[3,3,2,3], ...} 0 = 还没通过
    const p = {};
    UNITS.forEach((u) => u.levels.forEach((_, i) => { p[levelId(u, i)] = (bestByUnit[u.key] || [])[i] || 0; }));
    return p;
  }

  function initialState() {
    return {
      screen: 'wall',
      children: [
        { id: 'mi', name: '小米', avatar: 'mi', pin: '3816', fails: 0, lockedUntil: 0, stars: 128, fragments: 9, reviewDue: 6,
          companion: 'tuantuan', exp: 46, expNext: 60,
          progress: makeProgress({ u01: [3, 3, 2, 3], u02: [3, 2, 3, 3], u03: [3, 2] }) },
        { id: 'dou', name: '豆豆', avatar: 'dou', pin: '4729', fails: 0, lockedUntil: 0, stars: 41, fragments: 3, reviewDue: 3,
          companion: 'gulu', exp: 12, expNext: 30,
          progress: makeProgress({ u01: [2, 3, 1, 2], u02: [1, 2, 2, 3], u03: [1] }) },
        { id: 'bao', name: '阿宝', avatar: 'bao', pin: '6053', fails: 5, lockedUntil: now() + 12 * MIN, stars: 77, fragments: 5, reviewDue: 0,
          companion: 'momo', exp: 20, expNext: 30,
          progress: makeProgress({ u01: [3, 3, 3, 3], u02: [2, 2, 1] }) },
      ],
      picked: null, pin: '', pinError: '',
      childId: null,
      viewUnit: null,
      quiz: null,
      result: null,
      lastGrown: null,
      chat: { open: false, msgs: [], left: 20 },
      toast: '',
      panel: false,
      reduceMotion: false,
    };
  }

  let state = initialState();
  const listeners = [];
  const set = (patch) => { state = Object.assign({}, state, typeof patch === 'function' ? patch(state) : patch); listeners.forEach((f) => f(state)); };
  const child = (s = state) => s.children.find((c) => c.id === s.childId);
  const patchChild = (id, fn) => set((s) => ({ children: s.children.map((c) => (c.id === id ? Object.assign({}, c, fn(c)) : c)) }));

  // ---------- 解锁规则（learning §4.1.2）----------
  function courseView(c) {
    let prevUnitDone = true;
    return UNITS.map((u) => {
      const unlocked = prevUnitDone;
      let prevPassed = true;
      const levels = u.levels.map((title, i) => {
        const id = levelId(u, i);
        const best = c.progress[id];
        const open = unlocked && (best > 0 || prevPassed);
        prevPassed = best > 0;
        return { id, n: i + 1, title, best, status: best > 0 ? 'done' : open ? 'current' : 'locked' };
      });
      const passed = levels.filter((l) => l.best > 0).length;
      const done = passed === levels.length;
      prevUnitDone = unlocked && done;
      return { ...u, unlocked, done, passed, three: levels.filter((l) => l.best === 3).length, levels };
    });
  }
  function currentLevel(view) {
    for (const u of view) for (const l of u.levels) if (l.status === 'current') return { unit: u, level: l };
    return null;
  }

  // ---------- 发音（仅原型：浏览器 speechSynthesis）----------
  function speak(text) {
    try {
      if (!('speechSynthesis' in window)) throw new Error('none');
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US'; u.rate = 0.8; u.pitch = 1.1;
      speechSynthesis.speak(u);
    } catch { toast('这台设备不能播放发音，请家长帮忙看看声音设置'); }
  }

  let toastTimer;
  function toast(msg) { clearTimeout(toastTimer); set({ toast: msg }); toastTimer = setTimeout(() => set({ toast: '' }), 3200); }

  function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ---------- 动作 ----------
  let advanceTimer;
  const actions = {
    // 头像墙与 PIN
    pick({ id }) {
      const c = state.children.find((x) => x.id === id);
      set({ picked: id, pin: '', pinError: c.lockedUntil > now() ? 'locked' : '' });
    },
    unpick() { set({ picked: null, pin: '', pinError: '' }); },
    digit({ d }) {
      const c = state.children.find((x) => x.id === state.picked);
      if (!c || c.lockedUntil > now() || state.pin.length >= 4) return;
      const pin = state.pin + d;
      if (pin.length < 4) { set({ pin, pinError: '' }); return; }
      set({ pin });
      setTimeout(() => {
        if (pin === c.pin) {
          patchChild(c.id, () => ({ fails: 0 }));
          set({ childId: c.id, screen: 'home', picked: null, pin: '', pinError: '', viewUnit: null, lastGrown: null });
        } else {
          const fails = c.fails + 1;
          const locked = fails >= 5;
          patchChild(c.id, () => ({ fails, lockedUntil: locked ? now() + 15 * MIN : 0 }));
          set({ pin: '', pinError: locked ? 'locked' : `wrong:${5 - fails}` });
        }
      }, 180);
    },
    backspace() { set({ pin: state.pin.slice(0, -1), pinError: '' }); },
    parentEntry() { toast('家长入口：请家长用邮箱和密码登录（原型未包含）'); },
    switchChild() { set({ screen: 'wall', childId: null, quiz: null, result: null, chat: { ...state.chat, open: false, msgs: [] } }); },

    // 主页
    viewUnit({ key }) { set({ viewUnit: key }); },
    review() { const c = child(); toast(c.reviewDue ? `复习页还没做进原型：今天有 ${c.reviewDue} 个词到期` : '今天没有要复习的词'); },
    lockedLevel() { toast('先完成前面的关卡，这一关才会打开'); },
    lockedUnit() { toast('先完成上一个单元，这个单元才会打开'); },
    play({ level }) {
      if (!level.startsWith('u03')) { toast('原型只做了 Unit 3 Animals 的题目'); return; }
      const qs = QUESTIONS.map((q) => ({ ...q, options: q.options && shuffle(q.options), tiles: q.tiles && shuffle(q.tiles.map((t, i) => ({ t, i }))) }));
      set({ screen: 'quiz', result: null, quiz: { level, qs, idx: 0, answers: {}, picked: [], nudge: '' } });
      autoSay();
    },
    say({ text }) { speak(text); },
    exitQuiz() { clearTimeout(advanceTimer); set({ screen: 'home', quiz: null }); toast('这一关没做完，下次从第 1 题重新开始'); },

    // 答题
    choose({ opt }) {
      const q = state.quiz; const item = q.qs[q.idx];
      if (q.answers[q.idx]) return;
      const correct = opt === item.answer;
      record(correct, opt);
    },
    tile({ i }) {
      const q = state.quiz; if (q.answers[q.idx]) return;
      const idx = Number(i);
      if (q.picked.includes(idx)) return;
      set({ quiz: { ...q, picked: q.picked.concat(idx) } });
    },
    untile({ i }) {
      const q = state.quiz; if (q.answers[q.idx]) return;
      set({ quiz: { ...q, picked: q.picked.filter((x) => x !== Number(i)) } });
    },
    checkOrder() {
      const q = state.quiz; const item = q.qs[q.idx];
      if (q.picked.length < item.tiles.length) return;
      const text = q.picked.map((k) => item.tiles[k].t).join(' ');
      record(text === item.answer, text);
    },
    next() {
      clearTimeout(advanceTimer);
      const q = state.quiz;
      const firstOpen = q.qs.findIndex((_, i) => !q.answers[i]);
      if (firstOpen === -1) { set({ quiz: { ...q, idx: q.qs.length - 1 } }); return; }
      set({ quiz: { ...q, idx: firstOpen, picked: [], nudge: '' } });
      autoSay();
    },
    goto({ i }) {
      const q = state.quiz; const n = Number(i);
      if (!q.answers[n] && n !== q.qs.findIndex((_, k) => !q.answers[k])) return;
      clearTimeout(advanceTimer);
      set({ quiz: { ...q, idx: n, picked: [], nudge: '' } });
    },
    finish() {
      const q = state.quiz;
      const left = q.qs.length - Object.keys(q.answers).length;
      if (left > 0) { set({ quiz: { ...q, nudge: `还有 ${left} 题没做，全部做完才能完成这一关` } }); return; }
      settle();
    },
    hideout({ i }) {
      const r = state.result; const n = Number(i);
      if (r.spots[n].open) return;
      const spots = r.spots.map((s, k) => (k === n ? { ...s, open: true } : s));
      set({ result: { ...r, spots } });
      if (spots[n].found) patchChild(state.childId, (c) => ({ fragments: c.fragments + 1 }));
    },
    home() { set({ screen: 'home', quiz: null }); },
    again() { actions.play({ level: state.result.level }); },

    // 呀哈哈队长
    chatToggle() { set({ chat: { ...state.chat, open: !state.chat.open } }); },
    chatSend({ text }) {
      const input = document.getElementById('chat-input');
      const msg = (text || (input && input.value) || '').trim();
      if (!msg || state.chat.left <= 0) return;
      const reply = /duck/i.test(msg)
        ? 'duck 就是鸭子。点喇叭听我读一遍：duck！'
        : /笑话|joke/i.test(msg)
          ? 'Why is the fish so smart? Because it lives in a school! 鱼住在 school（鱼群/学校）里，所以很聪明。'
          : '（原型）这里会接上呀哈哈队长。你可以问我英文单词怎么读、是什么意思。';
      set({ chat: { ...state.chat, left: state.chat.left - 1, msgs: state.chat.msgs.concat({ me: msg }, { cap: reply, say: /duck/i.test(msg) ? 'duck' : '' }) } });
    },

    // 原型捷径（状态面板）
    protoUnlock() { set((s) => ({ children: s.children.map((c) => ({ ...c, fails: 0, lockedUntil: 0 })), pinError: '' })); toast('（原型）家长已解锁所有孩子'); },
    protoReset() { clearTimeout(advanceTimer); state = initialState(); set({}); },
    protoPanel() { set({ panel: !state.panel }); },
    protoMotion() { set({ reduceMotion: !state.reduceMotion }); },
    protoFill() { // 快速做到最后一题，便于看“未做完不能完成”和结算
      const q = state.quiz; if (!q) return;
      const answers = { ...q.answers };
      q.qs.forEach((it, i) => { if (i < q.qs.length - 1 && !answers[i]) answers[i] = { correct: true, response: it.answer }; });
      set({ quiz: { ...q, answers, idx: q.qs.length - 1, picked: [] } });
    },
  };

  function autoSay() {
    const q = state.quiz; const item = q && q.qs[q.idx];
    if (item && item.type === 'listen_choose') setTimeout(() => speak(item.say), 350);
  }

  function record(correct, response) {
    const q = state.quiz;
    const answers = { ...q.answers, [q.idx]: { correct, response } };
    set({ quiz: { ...q, answers, nudge: '' } });
    const allDone = Object.keys(answers).length === q.qs.length;
    if (correct && !allDone) advanceTimer = setTimeout(() => actions.next(), 600); // 答对 600 ms 自动下一题
  }

  // 结算（learning §4.1.4）：只算每题第一次作答
  function settle() {
    const q = state.quiz; const c = child();
    const S = q.qs.length; const C = Object.values(q.answers).filter((a) => a.correct).length;
    const passed = C * 100 >= S * 80;
    const stars = !passed ? 0 : C === S ? 3 : C * 100 >= S * 90 ? 2 : 1;
    const best = c.progress[q.level];
    const awarded = Math.max(0, stars - best);
    const fragments = passed ? stars : 0;
    const view = courseView(c);
    const unit = view.find((u) => q.level.startsWith(u.key));
    const level = unit.levels.find((l) => l.id === q.level);
    patchChild(c.id, (x) => ({
      stars: x.stars + awarded, fragments: x.fragments + fragments, exp: x.exp + awarded,
      progress: { ...x.progress, [q.level]: Math.max(best, stars) },
    }));
    const spots = passed ? [{ found: false }, { found: true }, { found: false }] : [];
    set({ screen: 'finish', result: { level: q.level, unit, levelN: level.n, S, C, passed, stars, awarded, fragments, spots }, lastGrown: passed && best === 0 ? q.level : null, quiz: null });
  }

  // ---------- 导出 ----------
  window.XY = {
    UNITS, QUESTIONS, TYPE_HINT, COMPANIONS, MIN,
    get state() { return state; },
    set, subscribe: (f) => listeners.push(f), actions, child, courseView, currentLevel, speak, toast, now,
    isCompact: () => window.innerWidth < 768,
    variants: {},
    esc: (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])),
    lockMinutes: (c) => Math.max(1, Math.ceil((c.lockedUntil - now()) / MIN)),
    pinMessage(c) {
      const e = state.pinError;
      if (c && c.lockedUntil > now()) return { kind: 'locked', text: '请 15 分钟后再试或请家长帮忙', sub: `大约还要 ${XY.lockMinutes(c)} 分钟` };
      if (e.startsWith('wrong:')) return { kind: 'wrong', text: 'PIN 不对，再试一次', sub: `还可以试 ${e.split(':')[1]} 次` };
      return { kind: '', text: '输入你的 4 位 PIN', sub: '' };
    },
  };
})();

/* 很小的共享片段（只是按钮集合，不含布局；每套方案自己摆放和上色）。 */
(function () {
  const A = XYArt;
  XY.ui = {
    keypad(cls) {
      const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
      return `<div class="${cls}" role="group" aria-label="数字键盘">${keys.map((k) => (k === ''
        ? '<span aria-hidden="true"></span>'
        : k === 'del'
          ? `<button data-action="backspace" data-fk="key-del" aria-label="删掉一位">${A.icons.del}</button>`
          : `<button data-action="digit" data-d="${k}" data-fk="key-${k}">${k}</button>`)).join('')}</div>`;
    },
    pinDots(cls, n) {
      return `<div class="${cls}" aria-label="已输入 ${n} 位，共 4 位">${[0, 1, 2, 3].map((i) => `<span class="${i < n ? 'is-on' : ''}"></span>`).join('')}</div>`;
    },
    // 当前题目的作答情况：{ item, ans, last, allDone, left }
    qinfo(q) {
      const item = q.qs[q.idx];
      const ans = q.answers[q.idx];
      const answered = Object.keys(q.answers).length;
      return { item, ans, answered, left: q.qs.length - answered, allDone: answered === q.qs.length, n: q.idx + 1, total: q.qs.length };
    },
    optState(item, ans, opt) {
      if (!ans) return '';
      if (opt === item.answer) return ans.correct ? 'is-right' : 'is-answer';
      if (opt === ans.response) return 'is-wrong';
      return 'is-dim';
    },
  };
})();
