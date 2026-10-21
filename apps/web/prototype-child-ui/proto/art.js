/* PROTOTYPE（用完即弃）：原型里手画的简单 SVG。全部原创几何形状，不是素材库、不是 emoji。
   只用 SVG 属性着色（不写 style 属性，主站 CSP 不允许内联样式）。 */
(function () {
  const svg = (inner, cls = '', vb = '0 0 120 120', label = '') =>
    `<svg class="${cls}" viewBox="${vb}" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true" focusable="false"'}>${inner}</svg>`;

  const ink = '#2A2A33';
  const animals = {
    cat: `
      <polygon points="28,52 36,16 58,40" fill="#F0A35E"/><polygon points="92,52 84,16 62,40" fill="#F0A35E"/>
      <polygon points="34,44 38,26 50,40" fill="#F9D7B5"/><polygon points="86,44 82,26 70,40" fill="#F9D7B5"/>
      <circle cx="60" cy="66" r="36" fill="#F0A35E"/>
      <path d="M52 34 q8 10 16 0 M47 40 q13 12 26 0" stroke="#D9853D" stroke-width="4" fill="none" stroke-linecap="round"/>
      <ellipse cx="46" cy="64" rx="4.5" ry="6.5" fill="${ink}"/><ellipse cx="74" cy="64" rx="4.5" ry="6.5" fill="${ink}"/>
      <polygon points="55,76 65,76 60,82" fill="#E26683"/>
      <path d="M60 82 q-6 8 -12 3 M60 82 q6 8 12 3" stroke="${ink}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M30 74 h-16 M30 80 l-14 5 M90 74 h16 M90 80 l14 5" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`,
    dog: `
      <ellipse cx="28" cy="62" rx="13" ry="27" fill="#7B4E2C" transform="rotate(18 28 62)"/>
      <ellipse cx="92" cy="62" rx="13" ry="27" fill="#7B4E2C" transform="rotate(-18 92 62)"/>
      <ellipse cx="60" cy="62" rx="32" ry="33" fill="#CB8D57"/>
      <ellipse cx="72" cy="52" rx="11" ry="10" fill="#A86A39"/>
      <circle cx="48" cy="54" r="4.5" fill="${ink}"/><circle cx="72" cy="54" r="4.5" fill="${ink}"/>
      <ellipse cx="60" cy="78" rx="18" ry="13" fill="#F3DDC2"/>
      <ellipse cx="60" cy="71" rx="7" ry="5" fill="${ink}"/>
      <path d="M60 76 v6 M60 82 q-6 5 -10 1 M60 82 q6 5 10 1" stroke="${ink}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M56 88 q4 8 8 0" fill="#E26683"/>`,
    duck: `
      <path d="M6 100 q12 -8 24 0 t24 0 t24 0 t24 0 t24 0 V120 H6 Z" fill="#9AD6EE"/>
      <ellipse cx="66" cy="82" rx="36" ry="20" fill="#FFD83A"/>
      <path d="M98 76 l14 -10 l-4 16 Z" fill="#FFD83A"/>
      <circle cx="42" cy="50" r="20" fill="#FFD83A"/>
      <ellipse cx="18" cy="56" rx="12" ry="6" fill="#FF9424"/>
      <circle cx="38" cy="45" r="3.5" fill="${ink}"/>
      <path d="M58 80 q14 -14 30 -2 q-14 12 -30 2 Z" fill="#F2C200"/>`,
    fish: `
      <circle cx="98" cy="22" r="5" fill="none" stroke="#7FC4EA" stroke-width="2.5"/><circle cx="106" cy="38" r="3" fill="none" stroke="#7FC4EA" stroke-width="2"/>
      <polygon points="86,62 112,40 112,84" fill="#3A84C2"/>
      <ellipse cx="54" cy="62" rx="38" ry="25" fill="#4FA4E2"/>
      <path d="M50 38 q14 -12 26 4 Z" fill="#3A84C2"/>
      <path d="M62 44 q8 18 0 36 M74 46 q7 16 0 32" stroke="#7FC4EA" stroke-width="4" fill="none" stroke-linecap="round"/>
      <circle cx="32" cy="56" r="7" fill="#fff"/><circle cx="31" cy="56" r="3.5" fill="${ink}"/>
      <path d="M18 68 q6 4 10 0" stroke="${ink}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
    bird: `
      <path d="M8 96 Q60 86 112 98" stroke="#7B4E2C" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M80 70 l26 -6 l-20 18 Z" fill="#B23A33"/>
      <circle cx="58" cy="60" r="30" fill="#E2544A"/>
      <ellipse cx="52" cy="70" rx="17" ry="16" fill="#FAD0A9"/>
      <path d="M64 56 q20 2 18 22 q-16 -2 -18 -22 Z" fill="#B23A33"/>
      <polygon points="28,52 14,57 28,61" fill="#FF9424"/>
      <circle cx="42" cy="50" r="4" fill="${ink}"/>
      <path d="M50 88 v8 M62 88 v8" stroke="#FF9424" stroke-width="3.5" stroke-linecap="round"/>`,
    rabbit: `
      <ellipse cx="45" cy="30" rx="9" ry="26" fill="#F3F1F6" stroke="#C9C4D6" stroke-width="2.5"/>
      <ellipse cx="75" cy="30" rx="9" ry="26" fill="#F3F1F6" stroke="#C9C4D6" stroke-width="2.5"/>
      <ellipse cx="45" cy="32" rx="4" ry="17" fill="#F6B8C8"/><ellipse cx="75" cy="32" rx="4" ry="17" fill="#F6B8C8"/>
      <circle cx="60" cy="74" r="32" fill="#F3F1F6" stroke="#C9C4D6" stroke-width="2.5"/>
      <circle cx="48" cy="68" r="4.5" fill="${ink}"/><circle cx="72" cy="68" r="4.5" fill="${ink}"/>
      <circle cx="40" cy="82" r="6" fill="#F6C4D1"/><circle cx="80" cy="82" r="6" fill="#F6C4D1"/>
      <ellipse cx="60" cy="80" rx="5" ry="3.5" fill="#E26683"/>
      <rect x="55.5" y="86" width="9" height="9" rx="2" fill="#fff" stroke="#C9C4D6" stroke-width="2"/>
      <path d="M60 86 v9" stroke="#C9C4D6" stroke-width="1.5"/>`,
  };
  const animalCn = { cat: '猫', dog: '狗', duck: '鸭子', fish: '鱼', bird: '小鸟', rabbit: '兔子' };

  // 原创头像：只用几何形状的孩子脸（不支持真实照片）。
  const avatars = {
    mi: { bg: '#FFC7D9', hair: '#4A2C21', skin: '#F7D3B8', extra: (h) => `<circle cx="34" cy="34" r="15" fill="${h}"/><circle cx="86" cy="34" r="15" fill="${h}"/>` , fringe: 'M32 58 Q36 30 60 30 Q84 30 88 58 Q74 44 60 48 Q46 44 32 58Z' },
    dou: { bg: '#BFE3FF', hair: '#2B2B33', skin: '#EEC39E', extra: () => '', fringe: 'M30 62 Q30 28 60 28 Q90 28 90 62 L84 50 L76 56 L68 46 L60 54 L52 46 L44 56 L36 50Z' },
    bao: { bg: '#CDEFB8', hair: '#3A2A1E', skin: '#F4CDAE', extra: () => `<path d="M26 50 Q28 22 60 22 Q92 22 94 50Z" fill="#FFC93C"/><rect x="22" y="46" width="76" height="9" rx="4.5" fill="#F0A800"/><circle cx="60" cy="20" r="6" fill="#F0A800"/>`, fringe: 'M34 56 Q40 46 60 48 Q80 46 86 56 L86 52 Q60 40 34 52Z' },
  };
  function avatar(id, cls = '') {
    const a = avatars[id];
    return svg(`
      <circle cx="60" cy="60" r="58" fill="${a.bg}"/>
      ${a.extra(a.hair)}
      <circle cx="60" cy="66" r="30" fill="${a.skin}"/>
      <path d="${a.fringe}" fill="${a.hair}"/>
      <circle cx="49" cy="68" r="3.6" fill="${ink}"/><circle cx="71" cy="68" r="3.6" fill="${ink}"/>
      <circle cx="43" cy="77" r="4.5" fill="#F4A3A8" opacity=".7"/><circle cx="77" cy="77" r="4.5" fill="#F4A3A8" opacity=".7"/>
      <path d="M53 80 q7 6 14 0" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M34 116 Q36 96 60 96 Q84 96 86 116Z" fill="${a.hair === '#2B2B33' ? '#4C7BD9' : '#fff'}" opacity=".9"/>`, cls);
  }

  // 伙伴：原创“种子团子”，头顶两片芽叶。mood: idle | happy | cheer | think
  function companion(c, mood = 'idle', cls = '') {
    const body = c.color, belly = c.belly;
    const eyes = mood === 'happy' || mood === 'cheer'
      ? `<path d="M44 74 q6 -7 12 0 M64 74 q6 -7 12 0" stroke="${ink}" stroke-width="4" fill="none" stroke-linecap="round"/>`
      : mood === 'think'
        ? `<circle cx="50" cy="74" r="4.5" fill="${ink}"/><circle cx="70" cy="74" r="4.5" fill="${ink}"/><path d="M43 66 l11 -5 M77 66 l-11 -5" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`
        : `<circle cx="50" cy="74" r="5" fill="${ink}"/><circle cx="70" cy="74" r="5" fill="${ink}"/><circle cx="52" cy="72" r="1.6" fill="#fff"/><circle cx="72" cy="72" r="1.6" fill="#fff"/>`;
    const mouth = mood === 'think'
      ? `<path d="M55 88 h10" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`
      : mood === 'cheer'
        ? `<path d="M50 85 q10 14 20 0 Z" fill="#B2324E"/>`
        : `<path d="M53 86 q7 6 14 0" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    const arms = mood === 'cheer'
      ? `<path d="M28 76 q-12 -14 -10 -28 M92 76 q12 -14 10 -28" stroke="${body}" stroke-width="9" fill="none" stroke-linecap="round"/>`
      : `<path d="M28 84 q-10 6 -12 16 M92 84 q10 6 12 16" stroke="${body}" stroke-width="9" fill="none" stroke-linecap="round"/>`;
    const sprout = c.sprout === 'star'
      ? `<path d="M60 40 v-10" stroke="#2E8B57" stroke-width="4" stroke-linecap="round"/><polygon points="60,10 64,22 76,22 66,29 70,41 60,33 50,41 54,29 44,22 56,22" fill="#FFC93C" stroke="#E0A800" stroke-width="2" stroke-linejoin="round"/>`
      : `<path d="M60 40 v-14" stroke="#2E8B57" stroke-width="4" stroke-linecap="round"/><path d="M60 28 q-20 -2 -24 -18 q18 -2 24 18Z" fill="#6CC04A"/><path d="M60 26 q18 -4 22 -20 q-18 0 -22 20Z" fill="#8CD66A"/>`;
    return svg(`
      ${sprout}
      ${arms}
      <path d="M60 38 C86 38 98 64 96 86 C94 106 80 114 60 114 C40 114 26 106 24 86 C22 64 34 38 60 38Z" fill="${body}"/>
      <ellipse cx="60" cy="96" rx="22" ry="14" fill="${belly}"/>
      ${eyes}
      <circle cx="40" cy="86" r="6" fill="#FF9AB0" opacity=".55"/><circle cx="80" cy="86" r="6" fill="#FF9AB0" opacity=".55"/>
      ${mouth}
      <ellipse cx="46" cy="114" rx="10" ry="5" fill="${body}"/><ellipse cx="74" cy="114" rx="10" ry="5" fill="${body}"/>`, cls, '0 0 120 124');
  }

  // 呀哈哈队长：原创小树灵（固定形象）——圆树冠里有一张脸，树干小身体，胸前一颗队长星。
  function captain(cls = '') {
    return svg(`
      <rect x="50" y="78" width="20" height="30" rx="8" fill="#8A5A34"/>
      <path d="M50 92 q-12 -2 -16 -12 M70 92 q12 -2 16 -12" stroke="#8A5A34" stroke-width="6" fill="none" stroke-linecap="round"/>
      <circle cx="36" cy="54" r="22" fill="#3FA65A"/><circle cx="84" cy="54" r="22" fill="#3FA65A"/>
      <circle cx="60" cy="44" r="30" fill="#52BE6B"/><circle cx="60" cy="62" r="24" fill="#52BE6B"/>
      <circle cx="50" cy="54" r="4.5" fill="${ink}"/><circle cx="70" cy="54" r="4.5" fill="${ink}"/>
      <path d="M52 66 q8 7 16 0" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>
      <polygon points="60,84 63,91 70,91 64.5,95.5 66.5,103 60,98.5 53.5,103 55.5,95.5 50,91 57,91" fill="#FFC93C"/>`, cls);
  }

  const star = (filled, cls = '') => svg(
    `<polygon points="12,2 15,9 22.5,9.3 16.6,14 18.7,21.5 12,17.3 5.3,21.5 7.4,14 1.5,9.3 9,9" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`,
    `${cls} ${filled ? 'is-on' : 'is-off'}`, '0 0 24 24');
  const icons = {
    speaker: svg('<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>', 'ic', '0 0 24 24'),
    back: svg('<path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>', 'ic', '0 0 24 24'),
    next: svg('<path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>', 'ic', '0 0 24 24'),
    close: svg('<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>', 'ic', '0 0 24 24'),
    lock: svg('<rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="2.4" fill="none"/>', 'ic', '0 0 24 24'),
    del: svg('<path d="M9 6h11v12H9l-6-6z" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linejoin="round"/><path d="M12 9.5l5 5M17 9.5l-5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>', 'ic', '0 0 24 24'),
    review: svg('<path d="M4 12a8 8 0 1 0 3-6.2" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M4 4v5h5" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>', 'ic', '0 0 24 24'),
    fragment: svg('<path d="M12 2l7 6-3 12H8L5 8z" fill="currentColor"/><path d="M12 2v18M5 8h14" stroke="#fff" stroke-width="1.4" opacity=".6"/>', 'ic', '0 0 24 24'),
    paw: svg('<ellipse cx="12" cy="15.5" rx="5" ry="4.2" fill="currentColor"/><circle cx="6" cy="10" r="2.2" fill="currentColor"/><circle cx="10" cy="6.5" r="2.2" fill="currentColor"/><circle cx="14" cy="6.5" r="2.2" fill="currentColor"/><circle cx="18" cy="10" r="2.2" fill="currentColor"/>', 'ic', '0 0 24 24'),
  };
  // 呀哈哈家族成员（藏匿点里发现的）：原创小精灵“松果呀”。
  const yahaha = svg(`
      <path d="M60 18 q-10 -12 -4 -14 q8 2 4 14Z" fill="#6CC04A"/>
      <path d="M60 20 C84 20 94 52 90 76 C86 100 74 110 60 110 C46 110 34 100 30 76 C26 52 36 20 60 20Z" fill="#B9773F"/>
      <path d="M36 50 q24 -10 48 0 M33 68 q27 -10 54 0 M36 86 q24 -10 48 0" stroke="#8D5628" stroke-width="4" fill="none"/>
      <ellipse cx="60" cy="78" rx="20" ry="18" fill="#F2D3A8"/>
      <circle cx="53" cy="76" r="3.5" fill="${ink}"/><circle cx="67" cy="76" r="3.5" fill="${ink}"/>
      <path d="M55 85 q5 4 10 0" stroke="${ink}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`, 'yahaha', '0 0 120 120');

  window.XYArt = { svg, animal: (n, cls = '') => svg(animals[n], cls, '0 0 120 120', `${n}（${animalCn[n]}）的图`), animalPlain: (n, cls = '') => svg(animals[n], cls), animalCn, avatar, companion, captain, star, icons, yahaha };
})();
