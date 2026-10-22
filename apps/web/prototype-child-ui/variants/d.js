/* PROTOTYPE（用完即弃）方案 D「森林探险图」：参考老系统（learning-platform）的“我的学习 + 闯关地图”结构重画。
   左边一栏“我的学习”（打招呼、跟随伙伴、继续闯关、复习小站），右边一张带木框的单元地图：虚线小路串起木牌圆章关卡、
   白色名牌和星级小牌、图例；答题沿用老系统的“题号 + 检查点小路 + 选项卡片带喇叭”。
   只参考结构与观感，没有复制老系统代码：场景是这里手写的 SVG。
   2026-10-22 用户决定加回老系统的积分、听读加分与马里奥：马里奥 / 林克用老系统的原图文件（assets/old-system/，任天堂第三方 IP，仅限本地原型），
   积分规则照老系统 server/community.mjs、server/pets.mjs 实现（见 README“方案 D：加回积分、听读加分与马里奥”）。 */
(function () {
  const A = XYArt; const { esc, ui } = XY;
  const LET = ['A', 'B', 'C', 'D'];

  // ---------- 老系统的搭档与冒险主题（src/GameBuddy.jsx、src/AdventureTrail.jsx、content/catalog.mjs）----------
  const BUDDY = {
    coins: { name: '马里奥 · 金币探险', img: 'mario', alt: '马里奥' },
    treasure: { name: '林克 · 宝箱冒险', img: 'link', alt: '林克' },
    moon: { name: '奥德赛 · 帽子与月亮', img: 'mario', alt: '马里奥' },
    kart: { name: '马里奥赛车 · 快乐出发', img: 'mario', alt: '马里奥' },
  };
  const TRAIL = { coins: '金币跳跃', kart: '卡丁车赛道', moon: '帽子与月亮旅行', treasure: '宝箱探险' };
  const unitAdventure = (n) => ['coins', 'treasure', 'moon', 'kart'][(n - 1) % 4]; // StudentHome.jsx：按单元序号轮换
  const levelAdventure = (i) => ['coins', 'kart', 'moon', 'treasure'][i % 4]; // catalog.mjs：按关卡序号轮换
  const buddyDeco = {
    coins: '<g stroke="#B18A36" stroke-width="2.5" fill="#F5C94C"><ellipse cx="30" cy="30" rx="13" ry="18"/><ellipse cx="30" cy="30" rx="7" ry="12" fill="#FFDA68"/></g>',
    moon: '<path d="M38 8q-12 20 10 26-18 18-34 0-12-20 24-26" fill="#F5D975" stroke="#BC973F" stroke-width="2.5"/>',
    treasure: '<g stroke="#4F4934" stroke-width="2.5" stroke-linejoin="round"><rect x="8" y="22" width="44" height="28" rx="4" fill="#B1834D"/><path d="M8 32h44M30 22v28" stroke="#F5C94C" stroke-width="5"/></g>',
    kart: '<g stroke="#3B3D31" stroke-width="2.5"><path d="M4 34h48l6 10H2z" fill="#E94339"/><circle cx="14" cy="48" r="7" fill="#35433C"/><circle cx="46" cy="48" r="7" fill="#35433C"/></g>',
  };
  function buddyCard(mode, cls = '') {
    const b = BUDDY[mode];
    return `<figure class="d-buddycard ${cls}"><span class="d-buddy-pic"><img src="assets/old-system/${b.img}.svg" alt="${b.alt}" width="240" height="240">${A.svg(buddyDeco[mode], 'd-buddy-deco', '0 0 60 60')}</span>
      <figcaption><b>${b.name}</b><small>答完一题，和搭档前进一步</small></figcaption></figure>`;
  }

  // ---------- 积分（老系统以 1/100 分为整数单位记账；10 单位 = 0.1 分）----------
  const START_UNITS = { mi: 2340, dou: 800, bao: 1520 };
  const START_YAHAHA = { mi: 2, dou: 1, bao: 4 };
  const YAHAHA_LIMIT = 1000; // server/yahaha/repository.mjs：收藏总上限默认 1000（管理员可设 1–100000）
  const PAL_LEVEL = { tuantuan: 12, gulu: 3, momo: 5 }; // 跟随伙伴的“陪伴等级”，对应老系统宠物等级
  const RATE_NODES = [[1, 10], [20, 20], [40, 35], [60, 55], [80, 75], [100, 100]]; // content/pet-rules.mjs petRateUnits
  // 规则按老系统 content/pet-rules.mjs 重写：在相邻两个节点之间线性插值，小数部分舍去
  function rateUnits(level) {
    const hi = RATE_NODES.findIndex(([lv]) => level <= lv);
    if (hi <= 0) return hi === 0 ? RATE_NODES[0][1] : 100;
    const [l0, r0] = RATE_NODES[hi - 1], [l1, r1] = RATE_NODES[hi];
    return r0 + Math.floor(((r1 - r0) * (level - l0)) / (l1 - l0));
  }
  const units = (s, id) => (s.dPoints && s.dPoints[id] !== undefined ? s.dPoints[id] : START_UNITS[id]);
  const yahahaCount = (s, id) => (s.dYahaha && s.dYahaha[id] !== undefined ? s.dYahaha[id] : START_YAHAHA[id]);
  const fmt = (u) => (u / 100).toFixed(u % 10 ? 2 : 1); // 老系统按 0.01 分记账，0.15 这类附赠要显示两位
  const sess = (s) => (s.dSess && s.quiz && s.dSess.qs === s.quiz.qs ? s.dSess : { qs: s.quiz && s.quiz.qs, claimed: {}, units: 0 });
  function addUnits(id, n, patch = {}) { const s = XY.state; XY.set({ dPoints: { ...(s.dPoints || {}), [id]: units(s, id) + n }, ...patch }); }
  // 闯关里点喇叭：本轮（这一次闯关）每个发音项目第一次听 +0.1 分；同一项目再听不再加分；没有每日上限（server/community.mjs awardListenPoints）。
  XY.actions.dSay = ({ text, key }) => {
    XY.speak(text);
    const s = XY.state; if (s.screen !== 'quiz' || !s.quiz || !key) return;
    const cur = sess(s); if (cur.claimed[key]) return;
    addUnits(s.childId, 10, { dSess: { ...cur, claimed: { ...cur.claimed, [key]: true }, units: cur.units + 10 } });
    XY.toast('🎉 认真听读 +0.1 积分！');
  };
  XY.actions.dPoints = () => XY.toast('积分小口袋：10 积分可以换 1 颗星（兑换页原型没做）');
  XY.actions.dYahaha = () => XY.toast(`呀哈哈森林口袋：已找到 ${yahahaCount(XY.state, XY.state.childId)} / ${YAHAHA_LIMIT} 位伙伴`);
  const coin = A.svg('<circle cx="12" cy="12" r="10" fill="#7C5CD6"/><circle cx="12" cy="12" r="7" fill="none" stroke="#fff" stroke-width="1.6" opacity=".7"/><text x="12" y="16" text-anchor="middle" font-size="11" font-weight="800" fill="#fff">分</text>', 'd-coin', '0 0 24 24');

  // 地图上的 5 个关卡位置（横屏 1000×560，竖屏 500×820）；CSS 里用同样的百分比摆放按钮。
  const SLOTS = {
    wide: [[120, 440], [310, 330], [500, 425], [700, 245], [880, 130]],
    tall: [[130, 680], [370, 560], [140, 420], [370, 280], [160, 130]],
  };
  // Catmull-Rom 转三次贝塞尔：让小路平滑地经过每个关卡
  function trail(pts) {
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(0)} ${c1[1].toFixed(0)} ${c2[0].toFixed(0)} ${c2[1].toFixed(0)} ${p2[0]} ${p2[1]}`;
    }
    return d;
  }
  const tree = (x, y, s = 1, tone = 0) => {
    const g = [['#4C8A4F', '#5E9E5A', '#7DB66A'], ['#3E7A55', '#4F9468', '#69AE7C']][tone];
    return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-6" y="-8" width="12" height="30" rx="4" fill="#8A5A34"/>
      <circle cx="-16" cy="-22" r="20" fill="${g[0]}"/><circle cx="16" cy="-24" r="20" fill="${g[0]}"/><circle cx="0" cy="-40" r="24" fill="${g[1]}"/><circle cx="-6" cy="-46" r="9" fill="${g[2]}"/></g>`;
  };
  const bush = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="-14" cy="0" r="14" fill="#5E9E5A"/><circle cx="12" cy="-2" r="16" fill="#6DAA60"/><circle cx="0" cy="-10" r="14" fill="#7DB66A"/></g>`;
  const flower = (x, y, c) => `<g transform="translate(${x} ${y})"><circle r="5" cx="-5" fill="${c}"/><circle r="5" cx="5" fill="${c}"/><circle r="5" cy="-5" fill="${c}"/><circle r="5" cy="5" fill="${c}"/><circle r="3.5" fill="#F5C94C"/></g>`;
  const critter = (n, x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">${A.animalPlain(n).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>`;
  const sign = (x, y, text) => `<g transform="translate(${x} ${y})"><rect x="-4" y="0" width="8" height="54" fill="#8A5A34"/>
    <rect x="-62" y="-30" width="124" height="40" rx="8" fill="#D89A55" stroke="#9C6331" stroke-width="3"/>
    <text x="0" y="-3" text-anchor="middle" class="d-sign-text" fill="#4A2C14">${esc(text)}</text></g>`;

  // 单元场景：远空、草坡、小溪与木桥、树和小花；Unit 3 动物园里藏着几只本单元的动物。
  function scene(u, tall) {
    const pts = SLOTS[tall ? 'tall' : 'wide'].slice(0, u.levels.length);
    const W = tall ? 500 : 1000, H = tall ? 820 : 560;
    const animals = u.key === 'u03';
    const deco = tall ? `
      <rect width="${W}" height="${H}" fill="#DDEDF0"/>
      <path d="M0 120 Q120 70 250 110 T500 90 V${H} H0Z" fill="#B9D7A8"/>
      <path d="M0 200 Q140 150 300 190 T500 170 V${H} H0Z" fill="#A8CB8A"/>
      <path d="M-20 450 C120 420 200 510 330 490 S470 470 520 510" stroke="#5FB3AE" stroke-width="54" fill="none"/>
      <path d="M-20 450 C120 420 200 510 330 490 S470 470 520 510" stroke="#8FCFCB" stroke-width="40" fill="none"/>
      <ellipse cx="120" cy="300" rx="70" ry="22" fill="#94B57B"/><ellipse cx="400" cy="770" rx="90" ry="26" fill="#94B57B"/>
      ${tree(440, 230, .9)}${tree(470, 440, .8, 1)}${tree(40, 610, .9, 1)}${tree(60, 280, .7)}${tree(455, 760, .8)}
      ${bush(260, 250, .9)}${bush(250, 400, .8)}${bush(470, 660, .9)}
      ${flower(220, 700, '#F49AB4')}${flower(300, 470, '#fff')}${flower(60, 410, '#F49AB4')}${flower(430, 380, '#fff')}
      ${sign(390, 120, `Unit ${u.n}`)}
      ${animals ? `${critter('rabbit', 395, 380, .5)}${critter('duck', 30, 470, .5)}${critter('bird', 400, 165, .38)}` : ''}`
      : `
      <rect width="${W}" height="${H}" fill="#DDEDF0"/>
      <path d="M0 110 Q160 50 330 95 T660 80 T1000 70 V${H} H0Z" fill="#B9D7A8"/>
      <path d="M0 170 Q220 120 460 160 T1000 140 V${H} H0Z" fill="#A8CB8A"/>
      <path d="M590 150 C600 250 630 290 630 330 S690 470 740 580" stroke="#5FB3AE" stroke-width="56" fill="none"/>
      <path d="M590 150 C600 250 630 290 630 330 S690 470 740 580" stroke="#8FCFCB" stroke-width="42" fill="none"/>
      <path d="M590 150 C600 120 640 100 700 96" stroke="#8FCFCB" stroke-width="30" fill="none"/>
      <ellipse cx="230" cy="215" rx="95" ry="34" fill="#8FCFCB" stroke="#5FB3AE" stroke-width="6"/>
      <ellipse cx="420" cy="520" rx="120" ry="30" fill="#94B57B"/><ellipse cx="860" cy="470" rx="110" ry="30" fill="#94B57B"/>
      ${tree(60, 300, .9, 1)}${tree(400, 200, .9)}${tree(560, 150, .7, 1)}${tree(960, 330, 1)}${tree(820, 520, .8, 1)}${tree(30, 520, .8)}
      ${bush(250, 470, 1)}${bush(600, 520, .9)}${bush(960, 200, .8)}${bush(440, 320, .7)}
      ${flower(170, 340, '#F49AB4')}${flower(390, 430, '#fff')}${flower(800, 380, '#F49AB4')}${flower(660, 470, '#fff')}${flower(920, 420, '#fff')}
      <path d="M840 250 h120 M840 270 h120" stroke="#B07A45" stroke-width="5"/>${[850, 880, 910, 940].map((x) => `<rect x="${x}" y="238" width="8" height="44" rx="3" fill="#9C6331"/>`).join('')}
      ${sign(110, 110, `Unit ${u.n}`)}
      ${animals ? `${critter('duck', 200, 160, .5)}${critter('rabbit', 760, 400, .55)}${critter('cat', 330, 470, .5)}${critter('bird', 520, 60, .4)}` : ''}`;
    const bridge = tall
      ? '<g transform="translate(255 492) rotate(31)"><rect x="-48" y="-22" width="96" height="44" rx="6" fill="#B07A45"/><path d="M-30 -22 v44 M-10 -22 v44 M10 -22 v44 M30 -22 v44" stroke="#8A5A34" stroke-width="4"/><path d="M-48 -22 h96 M-48 22 h96" stroke="#7A4A26" stroke-width="5"/></g>'
      : '<g transform="translate(640 300) rotate(-38)"><rect x="-52" y="-22" width="104" height="44" rx="6" fill="#B07A45"/><path d="M-32 -22 v44 M-12 -22 v44 M8 -22 v44 M28 -22 v44" stroke="#8A5A34" stroke-width="4"/><path d="M-52 -22 h104 M-52 22 h104" stroke="#7A4A26" stroke-width="5"/></g>';
    const d = trail(pts);
    return A.svg(`${deco}
      <path d="${d}" stroke="#E9D9A6" stroke-width="40" fill="none" stroke-linecap="round"/>
      <path d="${d}" stroke="#D9C185" stroke-width="40" fill="none" stroke-linecap="round" stroke-dasharray="0" opacity=".35"/>
      ${bridge}
      <path d="${d}" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-dasharray="1 16"/>`, 'd-scene', `0 0 ${W} ${H}`);
  }

  const leaf = A.svg('<path d="M5 19 C5 9 11 4 20 4 C20 13 15 19 5 19Z" fill="currentColor"/><path d="M5 19 L14 10" stroke="#fff" stroke-width="1.6"/>', 'ic d-leaf', '0 0 24 24');
  const book = A.svg('<path d="M3 5c3-1 6-1 9 1v14c-3-2-6-2-9-1z M21 5c-3-1-6-1-9 1v14c3-2 6-2 9-1z" fill="currentColor"/>', 'ic', '0 0 24 24');
  const flag = A.svg('<path d="M6 21V4M6 4h11l-3 4 3 4H6" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>', 'ic', '0 0 24 24');
  const logo = A.svg('<path d="M20 38 V22" stroke="#2E8B57" stroke-width="4" stroke-linecap="round"/><path d="M20 24 C8 24 4 14 4 8 C14 8 20 14 20 24Z" fill="#4CAF6A"/><path d="M20 22 C28 22 34 14 34 6 C26 6 20 12 20 22Z" fill="#7BC86C"/><polygon points="30,22 32.4,27 38,27.4 33.7,31 35,36.5 30,33.6 25,36.5 26.3,31 22,27.4 27.6,27" fill="#F5C94C" stroke="#C8921A" stroke-width="1.2" stroke-linejoin="round"/>', 'd-logo', '0 0 40 40');
  const plate = (best, cls = 'd-plate') => `<span class="${cls}" role="img" aria-label="${best} 星级">${[1, 2, 3].map((n) => A.star(n <= best, 'd-pstar')).join('')}</span>`;

  function topbar(c, s) {
    return `<header class="d-top">
      <p class="d-brand">${logo}<span>星芽学园</span></p>
      <p class="d-bank">
        <button class="d-yahaha" data-action="dYahaha" data-fk="top-yahaha" aria-label="呀哈哈森林口袋，已找到 ${yahahaCount(s, c.id)} 位，共 ${YAHAHA_LIMIT} 位"><img src="assets/old-system/yahaha-triple-96.png" alt="" width="34" height="40"><b>${yahahaCount(s, c.id)} / ${YAHAHA_LIMIT}</b></button>
        <button class="d-points" data-action="dPoints" data-fk="top-points" aria-label="我的积分 ${fmt(units(s, c.id))} 分">${coin}<b>${fmt(units(s, c.id))}</b><span class="d-points-l">积分</span></button>
        <span>${A.star(true, 'd-bank-star')}<b>${c.stars}</b><span class="xy-sr">颗星星</span></span><span class="d-bank-frag">${A.icons.fragment}<b>${c.fragments}</b><span class="xy-sr">片碎片</span></span></p>
      <div class="d-top-right">
        <p class="d-me">${A.avatar(c.avatar, 'd-me-av')}<span>${esc(c.name)}</span></p>
        <button class="d-btn-line d-small" data-action="switchChild" data-fk="switch">换人</button>
      </div>
      <nav class="d-nav" aria-label="孩子端导航">
        <button class="is-on" aria-current="page" data-action="home" data-fk="nav-home">我的学习</button>
        <button data-action="review" data-fk="nav-review">复习${c.reviewDue ? `<span class="d-badge">${c.reviewDue}</span>` : ''}</button>
        <button data-action="dPal" data-fk="nav-pal">我的伙伴</button>
      </nav>
    </header>`;
  }

  // ---------- 头像墙 ----------
  function wall(s) {
    const picked = s.children.find((c) => c.id === s.picked);
    const head = `<header class="d-top d-top-wall"><p class="d-brand">${logo}<span>星芽学园</span></p><button class="d-link" data-action="parentEntry" data-fk="parent">家长入口</button></header>`;
    if (!picked) {
      const kids = s.children.map((c, i) => {
        const locked = c.lockedUntil > XY.now();
        return `<li><button class="d-kid ${locked ? 'is-locked' : ''}" data-action="pick" data-id="${c.id}" data-fk="kid-${c.id}" ${i === 0 ? 'data-autofocus' : ''} aria-label="${esc(c.name)}${locked ? '，已锁定' : ''}">
          <span class="d-kid-ring">${A.avatar(c.avatar, 'd-kid-av')}</span>
          <span class="d-kid-name">${esc(c.name)}</span>
          <span class="d-kid-sub">${locked ? `${A.icons.lock}锁住了` : `${A.star(true, 'd-kid-star')}${c.stars}`}</span>
        </button></li>`;
      }).join('');
      return `<div class="d-page d-wall">${head}<main class="d-card d-wall-card"><h1>谁来学习？</h1><p class="d-sub">点一点自己的头像${leaf}</p><ul class="d-kids">${kids}</ul></main></div>`;
    }
    const m = XY.pinMessage(picked); const locked = m.kind === 'locked';
    return `<div class="d-page d-wall">${head}<main class="d-card d-pin-card">
      <button class="d-back" data-action="unpick" data-fk="unpick" aria-label="换一个人" ${locked ? 'data-autofocus' : ''}>${A.icons.back}</button>
      <section class="d-pin-who">
        <span class="d-kid-ring d-kid-ring-big">${A.avatar(picked.avatar, 'd-kid-av')}</span>
        <h1>${esc(picked.name)}</h1>
        <div class="d-pin-msg ${m.kind ? `is-${m.kind}` : ''}" role="${m.kind ? 'alert' : 'status'}"><p>${m.text}</p>${m.sub ? `<p class="d-pin-sub">${m.sub}</p>` : ''}</div>
      </section>
      ${locked ? '' : `<section class="d-pin-pad ${m.kind === 'wrong' ? 'is-shake' : ''}">${ui.pinDots('d-dots', s.pin.length)}${ui.keypad('d-keys')}</section>`}
    </main></div>`;
  }

  // ---------- 学习主页 + 关卡地图 ----------
  function home(s) {
    const c = XY.child(s);
    const view = XY.courseView(c); const cur = XY.currentLevel(view);
    const u = view.find((x) => x.key === s.viewUnit) || (cur ? cur.unit : view[view.length - 1]);
    const tall = XY.isCompact();
    const tabs = view.map((x) => `<button class="d-tab ${x.key === u.key ? 'is-on' : ''} ${x.unlocked ? '' : 'is-locked'}" data-action="viewUnit" data-key="${x.key}" data-fk="tab-${x.key}" aria-pressed="${x.key === u.key}" aria-label="Unit ${x.n} ${x.cn}${x.done ? '，已完成' : x.unlocked ? '' : '，还没解锁'}">
        <span class="d-tab-n" lang="en">Unit ${x.n}</span><span class="d-tab-cn">${x.unlocked ? (x.done ? A.star(true, 'd-tab-ic') : '') : A.icons.lock}${esc(x.cn)}</span></button>`).join('');
    const nodes = u.levels.map((l) => {
      const label = `第 ${l.n} 关 ${l.title}，${l.status === 'done' ? `${l.best} 星级` : l.status === 'current' ? '现在出发' : '等待解锁'}`;
      const act = !u.unlocked ? 'data-action="lockedUnit"' : l.status === 'locked' ? 'data-action="lockedLevel"' : `data-action="play" data-level="${l.id}"`;
      return `<li class="d-slot d-slot-${l.n}"><button class="d-node is-${u.unlocked ? l.status : 'locked'}" ${act} data-fk="node-${l.id}" aria-label="${esc(label)}">
        <span class="d-medal">${l.status === 'locked' || !u.unlocked ? A.icons.lock : `<span lang="en">${l.n}</span>`}</span>
        <span class="d-plaque"><span class="d-plaque-t" lang="en">${esc(l.title)}</span>
        ${l.status === 'done' ? plate(l.best) : `<span class="d-plaque-s">${l.status === 'current' && u.unlocked ? '现在出发' : '等待解锁'}</span>`}</span>
      </button></li>`;
    }).join('');
    const goCard = cur ? `<section class="d-go" aria-label="继续闯关">
        <p class="d-go-unit"><span lang="en">Unit ${cur.unit.n} ${esc(cur.unit.en)}</span>　第 ${cur.level.n} 关</p>
        <h2 lang="en">${esc(cur.level.title)}</h2>
        ${cur.unit.key === 'u03' ? `<div class="d-go-pics">${A.animalPlain('bird', 'd-go-pic')}${A.animalPlain('rabbit', 'd-go-pic')}</div>` : ''}
        <button class="d-btn" data-action="play" data-level="${cur.level.id}" data-fk="go" data-autofocus>继续闯关</button>
      </section>` : '<section class="d-go"><h2>这本书全部过关啦！</h2></section>';
    return `<div class="d-page d-home">${topbar(c, s)}
      <main class="d-home-main">
        <aside class="d-card d-study">
          <h1>你好，${esc(c.name)}！</h1>
          <p class="d-sub">${cur ? `今天去 <span lang="en">Unit ${cur.unit.n}</span> ${esc(cur.unit.cn)}探险吧` : '去复习站看看吧'}${leaf}</p>
          <p class="d-course">${book}一年级上册　英语</p>
          ${buddyCard(unitAdventure(u.n))}
          ${goCard}
          <section class="d-review">
            ${A.icons.review}<div><p class="d-review-t">复习小站</p><p class="d-review-s">${c.reviewDue ? `今天有 ${c.reviewDue} 个词该复习了` : '今天没有要复习的词'}</p><p class="d-review-s">复习答对 1 题 +1 积分，每天最多 30 分</p></div>
            <button class="d-btn-line" data-action="review" data-fk="review">去复习</button>
          </section>
        </aside>
        <section class="d-card d-map-card" aria-label="闯关地图">
          <header class="d-map-head">
            <h2><span lang="en">Unit ${u.n} ${esc(u.en)}</span> <span class="d-map-cn">${esc(u.cn)}</span></h2>
            <p class="d-map-count">${flag}<b>${u.passed} / ${u.levels.length}</b> 关已完成</p>
          </header>
          <div class="d-tabs" role="group" aria-label="选择单元">${tabs}</div>
          <div class="d-map ${tall ? 'is-tall' : 'is-wide'} ${u.unlocked ? '' : 'is-fog'}">
            ${scene(u, tall)}
            <ol class="d-nodes">${nodes}</ol>
            ${u.unlocked ? '' : `<p class="d-fog-note">${A.icons.lock}完成 <span lang="en">Unit ${u.n - 1}</span> 才能来这里</p>`}
          </div>
          <ul class="d-legend" aria-hidden="true"><li><span class="d-lg d-lg-cur"></span>现在出发</li><li>${A.star(true, 'd-lg-star')}已完成</li><li>${A.icons.lock}等待解锁</li></ul>
        </section>
      </main>
    </div>`;
  }

  // ---------- 闯关答题 ----------
  function quiz(s) {
    const q = s.quiz; const info = ui.qinfo(q); const { item, ans } = info;
    const c = XY.child(s);
    const view = XY.courseView(c); const unit = view.find((u) => q.level.startsWith(u.key)); const level = unit.levels.find((l) => l.id === q.level);
    const firstOpen = q.qs.findIndex((_, i) => !q.answers[i]);
    const done = Object.keys(q.answers).length; const total = q.qs.length;
    const theme = levelAdventure(level.n - 1);
    // 老系统 AdventureTrail：一条进度轨道 + 最多 5 个检查点 + 一个前进的小圆章（卡丁车主题是小车），只表示进度，不能点
    const marks = Array.from({ length: Math.min(total, 5) }, (_, i) => Math.ceil(((i + 1) * total) / Math.min(total, 5)));
    const markArt = theme === 'moon' ? '<path d="M7-12A14 14 0 1 0 9 12A11 11 0 0 1 7-12Z" fill="#F5C94C" stroke="#BA9031" stroke-width="2"/>'
      : theme === 'treasure' ? '<rect x="-11" y="-8" width="22" height="18" rx="3" fill="#CD9261" stroke="#85613F" stroke-width="2"/><path d="M-11-1H11M0-8V10" stroke="#F5C94C" stroke-width="3"/>'
        : '<ellipse rx="8" ry="12" fill="#F5C94C" stroke="#C99D30" stroke-width="2"/><path d="M0-6V6" stroke="#FFF4B5" stroke-width="3"/>';
    const traveler = theme === 'kart' ? '<path d="M-18-12H9L18-3V3H-20V-5Z" fill="#E87966" stroke="#AD4F44" stroke-width="2"/><circle cx="-12" cy="5" r="6" fill="#243D37"/><circle cx="12" cy="5" r="6" fill="#243D37"/>'
      : '<circle r="17" fill="#147A66" stroke="white" stroke-width="3"/><path d="M-7 0L-2 5L8-6" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"/>';
    const trail = `<div class="d-trail" role="progressbar" aria-label="${TRAIL[theme]}进度" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}" aria-valuetext="已完成 ${done} / ${total} 题">
      <span class="d-rail"></span><span class="d-fill d-p-${done}"></span>
      ${marks.map((m) => A.svg(markArt, `d-mark d-p-${m} ${done >= m ? 'is-reached' : ''}`, '-16 -16 32 32')).join('')}
      ${A.svg(traveler, `d-traveler d-p-${done}`, '-24 -26 48 48')}</div>`;
    const cur = sess(s);
    const say = (text, key, label, fk, cls = 'd-say') => `<button class="${cls} ${cur.claimed[key] ? 'is-claimed' : ''}" data-action="dSay" data-text="${text}" data-key="${key}" data-fk="${fk}" aria-label="${label}">${A.icons.speaker}</button>`;
    const qKey = `q:${q.idx}`;
    let ask = ''; let pick = '';
    if (item.type === 'pick_image') ask = `<h2 class="d-ask">这是什么？</h2>${A.animal(item.animal, 'd-q-art')}`;
    else if (item.type === 'listen_choose') ask = `<h2 class="d-ask">你听到了哪个词？</h2><button class="d-listen" data-action="dSay" data-text="${item.say}" data-key="${qKey}" data-fk="say" ${ans ? '' : 'data-autofocus'}>${A.icons.speaker}<span>再听一遍</span></button>`;
    else ask = `<h2 class="d-ask">把词块排成一句话</h2><div class="d-q-row">${A.animalPlain(item.animal, 'd-q-art d-q-art-sm')}${say(item.answer, qKey, '听这句话', 'say', 'd-say d-say-big')}</div>`;
    // 老系统 Learning.jsx 的听读提示：没听过时“每项首次听读 +0.1 积分”，听过后“听读 +0.1 积分 · 本题已获 N 分”
    const got = Object.keys(cur.claimed).filter((k) => k === qKey || k.startsWith(`o:${q.idx}:`)).length * 10;
    ask += `<p class="d-listen-hint" role="status" aria-live="polite">${A.icons.speaker}${got ? `听读 +0.1 积分，本题已获 ${fmt(got)} 分` : '每项首次听读 +0.1 积分'}</p>`;
    if (item.type === 'order') {
      const show = ans ? ans.response.split(' ') : q.picked.map((k) => item.tiles[k].t);
      pick = `<div class="d-line ${ans ? (ans.correct ? 'is-right' : 'is-wrong') : ''}" aria-label="排好的句子">${item.tiles.map((_, i) => (show[i]
        ? `<button class="d-chip is-placed" lang="en" ${ans ? 'disabled' : `data-action="untile" data-i="${q.picked[i]}" data-fk="slot-${i}"`}>${esc(show[i])}</button>`
        : '<span class="d-chip-gap"></span>')).join('')}</div>
        ${ans ? '' : `<div class="d-chips">${item.tiles.map((t, i) => (q.picked.includes(i) ? '' : `<button class="d-chip" lang="en" data-action="tile" data-i="${i}" data-fk="tile-${i}">${esc(t.t)}</button>`)).join('')}</div>
        <button class="d-btn" data-action="checkOrder" data-fk="check" ${q.picked.length < item.tiles.length ? 'disabled' : ''}>排好了</button>`}`;
    } else {
      // 老系统每个选项都带喇叭；听音选词题如果也带，就等于把答案读出来了，所以这一题型不放。
      const speakers = item.type !== 'listen_choose';
      pick = `<ul class="d-opts">${item.options.map((o, i) => `<li class="d-opt-row ${ui.optState(item, ans, o)}">
        <button class="d-opt" lang="en" data-action="choose" data-opt="${o}" data-fk="opt-${o}" ${ans ? 'aria-disabled="true"' : ''}><span class="d-opt-l" aria-hidden="true">${LET[i]}</span><span class="d-opt-w">${esc(o)}</span></button>
        ${speakers ? say(o, `o:${q.idx}:${o}`, `听 ${o} 的发音`, `say-${o}`) : ''}</li>`).join('')}</ul>`;
    }
    let fb = '';
    if (ans) {
      const btn = info.allDone ? '<button class="d-btn" data-action="finish" data-fk="finish-main" data-autofocus>完成这一关</button>'
        : !ans.correct ? '<button class="d-btn" data-action="next" data-fk="next" data-autofocus>下一题</button>'
          : q.idx !== firstOpen ? `<button class="d-btn" data-action="next" data-fk="next">回到第 ${firstOpen + 1} 题</button>` : '';
      const fbKey = item.type === 'order' || item.type === 'listen_choose' ? qKey : `o:${q.idx}:${item.answer}`;
      fb = `<section class="d-fb ${ans.correct ? 'is-right' : 'is-wrong'}" id="d-fb" role="status">
        <div class="d-fb-text"><p class="d-fb-t">${ans.correct ? '答对了！' : '再认识它一次'}</p><p class="d-fb-s">${esc(item.explain)}</p></div>
        <div class="d-fb-act">${say(item.answer, fbKey, '听正确答案', 'fb-say')}${btn}</div></section>`;
    }
    return `<div class="d-page d-quiz">
      <header class="d-qhead">
        <button class="d-back" data-action="exitQuiz" data-fk="exit" aria-label="退出这一关">${A.icons.back}</button>
        <div><h1 lang="en">${esc(level.title)}</h1><p class="d-sub">Unit ${unit.n} 第 ${level.n} 关，慢慢想，一次回答一个问题。</p></div>
        <button class="d-finish ${info.allDone ? '' : 'is-wait'}" data-action="finish" data-fk="finish" aria-describedby="d-nudge">${info.allDone ? '完成这一关' : `还差 ${info.left} 题`}</button>
      </header>
      <main class="d-card d-qcard">
        <div class="d-qbar">
          <p class="d-qn">第 <b>${info.n}</b> / ${info.total} 题</p>
          ${trail}
          <p class="d-qtheme">${TRAIL[theme]}</p>
        </div>
        <p class="d-hint">${XY.TYPE_HINT[item.type]}</p>
        <p id="d-nudge" class="d-nudge" role="alert">${esc(q.nudge || '')}</p>
        <div class="d-qbody"><div class="d-qask">${ask}</div><div class="d-qpick">${pick}</div></div>
        ${fb}
      </main>
    </div>`;
  }

  // ---------- 结算 ----------
  function finish(s) {
    const r = s.result; const c = XY.child(s); const comp = XY.COMPANIONS[c.companion];
    const pts = s.dSettle && r.dKey && s.dSettle.key === r.dKey ? s.dSettle : { listen: 0, pal: 0, level: PAL_LEVEL[c.companion], rate: rateUnits(PAL_LEVEL[c.companion]) };
    const theme = levelAdventure(r.levelN - 1);
    const spots = r.spots.map((sp, i) => `<li><button class="d-spot ${sp.open ? 'is-open' : ''}" data-action="hideout" data-i="${i}" data-fk="spot-${i}" ${sp.open ? 'aria-disabled="true"' : ''} aria-label="${sp.open ? (sp.found ? '找到了松果呀' : '这里什么也没有') : `翻开第 ${i + 1} 个藏匿点`}">
      ${sp.open ? (sp.found ? `${A.yahaha}<span>松果呀！碎片 +1</span>` : `${A.svg(bush(40, 40, 1), 'd-spot-art', '0 0 80 60')}<span>空空的</span>`)
        : `${A.svg(bush(40, 40, 1.15), 'd-spot-art', '0 0 80 60')}<span>翻开看看</span>`}</button></li>`).join('');
    return `<div class="d-page d-end">${topbar(c, s)}
      <main class="d-card d-end-card">
        <div class="d-end-top">
          ${buddyCard(theme, 'is-compact')}
          <div>
            <h1>${r.passed ? `闯过第 ${r.levelN} 关啦！` : '差一点点，再来一次吧'}</h1>
            <p class="d-sub"><span lang="en">Unit ${r.unit.n}</span> 第 ${r.levelN} 关，答对 ${r.C} / ${r.S} 题${r.passed ? '' : `，答对 ${Math.ceil(r.S * 0.8)} 题就能过关`}</p>
            <div class="d-end-plate">${plate(r.stars, 'd-plate d-plate-big')}</div>
          </div>
        </div>
        <ul class="d-gains">
          ${r.passed ? `<li>${A.star(true, 'd-bank-star')}<span>星星</span><b>+${r.awarded}</b></li>
          <li class="d-bank-frag">${A.icons.fragment}<span>碎片</span><b>+${r.fragments}</b></li>` : ''}
          <li class="d-gain-pts">${coin}<span>积分</span><b>+${fmt(pts.listen + pts.pal)}</b></li>
          ${r.passed ? `<li class="d-gain-pal">${A.icons.paw}<span>${esc(comp.name)}的经验</span><b>+${r.awarded}</b></li>` : ''}</ul>
        <p class="d-note">${A.icons.speaker}本轮听读获得 ${fmt(pts.listen)} 积分${r.passed && r.awarded === 0 ? '；这一关以前拿过同样的星级，这次不再加星星' : ''}</p>
        ${pts.pal ? `<div class="d-palbonus" role="status">${A.companion(comp, 'cheer', 'd-end-pal')}<div><p class="d-palbonus-t">${esc(comp.name)}送你 ${fmt(pts.pal)} 积分</p>
          <p class="d-sub">本次新增 ${r.awarded} 星，陪伴等级 ${pts.level}，每星附赠 ${fmt(pts.rate)} 分</p></div></div>`
          : `<div class="d-palbonus">${A.companion(comp, r.passed ? 'happy' : 'think', 'd-end-pal')}<div><p class="d-palbonus-t">跟随伙伴 ${esc(comp.name)}</p><p class="d-sub">${r.passed ? '这次没有新增星星，没有附赠积分' : '过关拿到新星星时，每颗星会附赠积分'}</p></div></div>`}
        ${r.passed ? `<section class="d-spots" aria-label="藏匿点"><h2>藏匿点</h2><p class="d-sub">呀哈哈家族成员藏在灌木丛里，翻开看看</p><ul>${spots}</ul></section>` : ''}
        <div class="d-end-act">${r.passed
          ? '<button class="d-btn" data-action="home" data-fk="home" data-autofocus>回到地图</button><button class="d-btn-line" data-action="again" data-fk="again">再玩一次</button>'
          : '<button class="d-btn" data-action="again" data-fk="again" data-autofocus>再玩一次</button><button class="d-btn-line" data-action="home" data-fk="home">回到地图</button>'}</div>
      </main>
    </div>`;
  }

  let lastIdx = -1;
  XY.actions.dPal = () => XY.toast('“我的伙伴”页还没做进原型');
  XY.variants.D = {
    name: '森林探险图·参考老系统',
    render(s) { return { wall, home, quiz, finish }[s.screen](s); },
    after(s) {
      // 结算：本轮听读积分已经实时记入；再按“本次新增星星 × 跟随伙伴每星附赠”加伙伴附赠积分（server/pets.mjs awardPetPoints），只结一次
      // core 的 settle 每次新结算都会生成新的 spots；翻藏匿点只换 result 外壳，所以用“结算时的关卡+时间戳”识别一次结算
      if (s.screen === 'finish' && s.result && !s.result.dKey) { XY.set({ result: { ...s.result, dKey: `${s.result.level}:${Date.now()}` } }); return; }
      if (s.screen === 'finish' && s.result && (!s.dSettle || s.dSettle.key !== s.result.dKey)) {
        const c = XY.child(s); const level = PAL_LEVEL[c.companion]; const rate = rateUnits(level);
        const pal = s.result.passed ? s.result.awarded * rate : 0;
        const listen = s.dSess ? s.dSess.units : 0;
        addUnits(c.id, pal, { dSettle: { key: s.result.dKey, listen, pal, level, rate, yahaha: 0 }, dSess: null });
        return;
      }
      // 藏匿点找到呀哈哈 → 呀哈哈收藏数 +1（老系统顶栏“已找到 N / 1000”）
      if (s.screen === 'finish' && s.dSettle && s.dSettle.key === s.result.dKey) {
        const found = s.result.spots.filter((x) => x.open && x.found).length;
        if (found > s.dSettle.yahaha) {
          XY.set({ dYahaha: { ...(s.dYahaha || {}), [s.childId]: yahahaCount(s, s.childId) + (found - s.dSettle.yahaha) }, dSettle: { ...s.dSettle, yahaha: found } });
          return;
        }
      }
      if (s.screen !== 'quiz') { lastIdx = -1; return; }
      if (s.dSess && s.dSess.qs !== s.quiz.qs) { XY.set({ dSess: null }); return; } // 新的一轮：上一轮没结算的听读记录作废
      if (s.quiz.answers[s.quiz.idx]) { const el = document.getElementById('d-fb'); if (el) el.scrollIntoView({ block: XY.isCompact() ? 'center' : 'nearest' }); }
      else if (s.quiz.idx !== lastIdx) window.scrollTo(0, 0); // 换题时回到顶部，手机上不会停在上一题的反馈位置
      lastIdx = s.quiz.idx;
    },
    // 原型状态面板里多出的几行（boot.js 调用）
    stateRows(s) {
      const c = XY.child(s); if (!c) return [];
      const rows = [['积分', `${fmt(units(s, c.id))} 分（10 分可换 1 星）`], ['呀哈哈收藏', `${yahahaCount(s, c.id)} / ${YAHAHA_LIMIT}`],
        ['伙伴附赠', `${XY.COMPANIONS[c.companion].name} 陪伴等级 ${PAL_LEVEL[c.companion]}，每星附赠 ${fmt(rateUnits(PAL_LEVEL[c.companion]))} 分`]];
      if (s.quiz) { const cur = sess(s); rows.push(['本轮听读', `已听 ${Object.keys(cur.claimed).length} 项，+${fmt(cur.units)} 分（同一项本轮只加一次，无每日上限）`]); }
      if (s.dSettle && s.screen === 'finish') rows.push(['结算积分', `听读 ${fmt(s.dSettle.listen)} + 伙伴附赠 ${fmt(s.dSettle.pal)}`]);
      return rows;
    },
  };
})();
