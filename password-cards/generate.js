/* בניית גיליונות A4 של כרטיסיות + הפקת PDF דו-צדדי — הכל בדפדפן.
   עיצוב צבעוני לילדים: 4 עולמות נושא (חיות/חלל/גיבורים/קשת) + "כיתת קשת"
   (כל תלמיד מקבל צבע אחר). מבנה HTML לכל נושא; הגודל נקבע ע"י ‎--u‎.
   כל האיורים = SVG שטוח (shapes/paths/gradients) — בטוח ל-html2canvas. */
(function () {
  'use strict';

  const TEMPLATES = [
    { id: 'animals', label: '🐾 חיות' },
    { id: 'dinosaurs', label: '🦕 דינוזאורים' },
    { id: 'sea', label: '🐙 עולם הים' },
    { id: 'vehicles', label: '🚗 כלי תחבורה' },
    { id: 'food', label: '🍓 אוכל' },
    { id: 'space', label: '🚀 חלל' },
    { id: 'heroes', label: '🦸 גיבורים' },
    { id: 'rainbow', label: '🌈 קשת' },
    { id: 'plain', label: '⬜ פשוט' },
  ];
  const SIZES = [
    { id: 'xl', label: 'ענק', note: '4 בעמוד', cols: 2, rows: 2 },
    { id: 'large', label: 'גדול', note: '6 בעמוד', cols: 2, rows: 3 },
    { id: 'medium', label: 'בינוני', note: '8 בעמוד', cols: 2, rows: 4 },
    { id: 'small', label: 'קטן', note: '12 בעמוד', cols: 3, rows: 4 },
    { id: 'mini', label: 'זעיר', note: '20 בעמוד', cols: 4, rows: 5 },
    { id: 'micro', label: 'ננו', note: '32 בעמוד', cols: 4, rows: 8 },
  ];

  // כיתת קשת — 8 סטים חיים; כל תלמיד לפי אינדקס.
  const PALETTE = [
    { bg: '#FFE4E9', accent: '#FF5D73', deep: '#C81E4A', ink: '#7A1128' }, // אלמוגי
    { bg: '#FFEAD6', accent: '#FF8A3D', deep: '#D8600F', ink: '#7A3405' }, // כתום
    { bg: '#FFF3D1', accent: '#F5B012', deep: '#B97C00', ink: '#5F4200' }, // ענבר
    { bg: '#D8F7E4', accent: '#22C56B', deep: '#12924B', ink: '#0A4F26' }, // ירוק
    { bg: '#D4F5F7', accent: '#17BEC6', deep: '#0C878D', ink: '#06474A' }, // טורקיז
    { bg: '#DEEEFF', accent: '#3D9BFF', deep: '#1667D4', ink: '#0A3574' }, // שמיים
    { bg: '#EEE1FB', accent: '#9B5DE5', deep: '#6A2FB8', ink: '#38175F' }, // סגול
    { bg: '#FFE1F0', accent: '#FF6FB5', deep: '#D83E8C', ink: '#74183F' }, // ורוד
  ];
  const colorForStudent = (i) => PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length];

  const PAGE_W = 210, PAGE_H = 297, MARGIN = 8; // mm
  const PX_PER_MM = 3.7795;
  const EYE = '#2A2540';

  function sizeById(id) { return SIZES.find((s) => s.id === id) || SIZES[1]; }
  function norm(o) {
    return {
      template: (o && o.template) || 'animals',
      size: (o && o.size) || 'medium',
      textScale: (o && o.textScale) || 1.15,
    };
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function chunk(arr, n) { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; }
  function initial(st) { const s = (st.fullName || '').trim(); return s ? s[0] : '★'; }
  function cstyle(c) { return '--c-bg:' + c.bg + ';--c-accent:' + c.accent + ';--c-deep:' + c.deep + ';--c-ink:' + c.ink; }

  // ---------- ספריית איורים (SVG שטוח) ----------
  const SVG = (inner, extra) =>
    '<svg class="pc-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"' + (extra || '') + '>' + inner + '</svg>';

  // חיות — צבועות בצבע התלמיד (accent גוף, deep צל, לבן+כהה פרטים)
  const ANIMALS = {
    fox: (c) => SVG(
      '<path d="M18 32 L30 6 L46 28 Z" fill="' + c.deep + '"/><path d="M82 32 L70 6 L54 28 Z" fill="' + c.deep + '"/>' +
      '<circle cx="50" cy="52" r="34" fill="' + c.accent + '"/>' +
      '<path d="M50 88 C33 88 25 70 30 60 L70 60 C75 70 67 88 50 88 Z" fill="#fff"/>' +
      '<circle cx="37" cy="50" r="4.6" fill="' + EYE + '"/><circle cx="63" cy="50" r="4.6" fill="' + EYE + '"/>' +
      '<path d="M50 60 l6 8 h-12 Z" fill="' + EYE + '"/>'),
    owl: (c) => SVG(
      '<path d="M22 26 L34 14 L40 30 Z" fill="' + c.deep + '"/><path d="M78 26 L66 14 L60 30 Z" fill="' + c.deep + '"/>' +
      '<circle cx="50" cy="54" r="36" fill="' + c.accent + '"/>' +
      '<circle cx="37" cy="49" r="14" fill="#fff"/><circle cx="63" cy="49" r="14" fill="#fff"/>' +
      '<circle cx="37" cy="49" r="6.5" fill="' + EYE + '"/><circle cx="63" cy="49" r="6.5" fill="' + EYE + '"/>' +
      '<path d="M50 56 l6 9 h-12 Z" fill="' + c.deep + '"/>' +
      '<path d="M30 74 q20 12 40 0" stroke="' + c.deep + '" stroke-width="3" fill="none" stroke-linecap="round"/>'),
    bear: (c) => SVG(
      '<circle cx="27" cy="30" r="13" fill="' + c.accent + '"/><circle cx="73" cy="30" r="13" fill="' + c.accent + '"/>' +
      '<circle cx="27" cy="30" r="6" fill="' + c.deep + '"/><circle cx="73" cy="30" r="6" fill="' + c.deep + '"/>' +
      '<circle cx="50" cy="55" r="34" fill="' + c.accent + '"/>' +
      '<ellipse cx="50" cy="64" rx="17" ry="13" fill="#fff"/>' +
      '<circle cx="40" cy="49" r="4.6" fill="' + EYE + '"/><circle cx="60" cy="49" r="4.6" fill="' + EYE + '"/>' +
      '<ellipse cx="50" cy="60" rx="5.5" ry="4.2" fill="' + EYE + '"/>' +
      '<path d="M50 64 v6 M50 70 q-6 4 -10 2 M50 70 q6 4 10 2" stroke="' + EYE + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>'),
    bunny: (c) => SVG(
      '<rect x="33" y="4" width="12" height="42" rx="6" fill="' + c.accent + '"/><rect x="55" y="4" width="12" height="42" rx="6" fill="' + c.accent + '"/>' +
      '<rect x="36" y="10" width="6" height="30" rx="3" fill="' + c.deep + '"/><rect x="58" y="10" width="6" height="30" rx="3" fill="' + c.deep + '"/>' +
      '<circle cx="50" cy="60" r="30" fill="' + c.accent + '"/>' +
      '<circle cx="40" cy="56" r="4.4" fill="' + EYE + '"/><circle cx="60" cy="56" r="4.4" fill="' + EYE + '"/>' +
      '<ellipse cx="50" cy="66" rx="4.6" ry="3.4" fill="' + c.deep + '"/>' +
      '<path d="M50 69 v4" stroke="' + EYE + '" stroke-width="2" stroke-linecap="round"/>'),
    cat: (c) => SVG(
      '<path d="M20 30 L26 8 L44 24 Z" fill="' + c.accent + '"/><path d="M80 30 L74 8 L56 24 Z" fill="' + c.accent + '"/>' +
      '<path d="M25 26 L28 14 L38 24 Z" fill="' + c.deep + '"/><path d="M75 26 L72 14 L62 24 Z" fill="' + c.deep + '"/>' +
      '<circle cx="50" cy="54" r="33" fill="' + c.accent + '"/>' +
      '<circle cx="39" cy="52" r="4.6" fill="' + EYE + '"/><circle cx="61" cy="52" r="4.6" fill="' + EYE + '"/>' +
      '<path d="M50 60 l4 5 h-8 Z" fill="' + c.deep + '"/>' +
      '<path d="M50 65 q-6 5 -12 3 M50 65 q6 5 12 3" stroke="' + EYE + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
      '<path d="M20 54 h14 M20 60 h14 M66 54 h14 M66 60 h14" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>'),
    frog: (c) => SVG(
      '<circle cx="33" cy="30" r="15" fill="' + c.accent + '"/><circle cx="67" cy="30" r="15" fill="' + c.accent + '"/>' +
      '<circle cx="50" cy="58" r="34" fill="' + c.accent + '"/>' +
      '<circle cx="33" cy="28" r="8" fill="#fff"/><circle cx="67" cy="28" r="8" fill="#fff"/>' +
      '<circle cx="33" cy="28" r="4" fill="' + EYE + '"/><circle cx="67" cy="28" r="4" fill="' + EYE + '"/>' +
      '<path d="M30 64 q20 16 40 0" stroke="' + EYE + '" stroke-width="4" fill="none" stroke-linecap="round"/>' +
      '<circle cx="36" cy="70" r="3" fill="' + c.deep + '"/><circle cx="64" cy="70" r="3" fill="' + c.deep + '"/>'),
  };
  const ANIMAL_TYPES = ['fox', 'owl', 'bear', 'bunny', 'cat', 'frog'];
  const animalSvg = (i, c) => ANIMALS[ANIMAL_TYPES[i % ANIMAL_TYPES.length]](c);

  // 🦕 דינוזאורים — גוף מלא (צוואר/זנב = קווים עבים מעוגלים), כדי שייקרא "דינוזאור"
  const legs = (c, xs, y, h) => xs.map((x) => '<rect x="' + x + '" y="' + y + '" width="8" height="' + h + '" rx="4" fill="' + c.deep + '"/>').join('');
  const DINOS = {
    longneck: (c) => SVG(
      '<path d="M78 62 Q94 58 90 44" stroke="' + c.accent + '" stroke-width="9" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="54" cy="66" rx="28" ry="17" fill="' + c.accent + '"/>' +
      '<path d="M33 66 Q20 40 36 24 Q42 18 50 22" stroke="' + c.accent + '" stroke-width="15" fill="none" stroke-linecap="round"/>' +
      '<circle cx="35" cy="22" r="10" fill="' + c.accent + '"/>' +
      legs(c, [40, 62], 78, 15) +
      '<circle cx="31" cy="20" r="2.6" fill="' + EYE + '"/><circle cx="46" cy="62" r="4" fill="#fff" opacity=".35"/>'),
    trex: (c) => SVG(
      '<path d="M22 62 Q4 68 8 82" stroke="' + c.accent + '" stroke-width="11" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="44" cy="60" rx="23" ry="21" fill="' + c.accent + '"/>' +
      '<circle cx="63" cy="36" r="17" fill="' + c.accent + '"/>' +
      '<path d="M60 44 h21 q3 0 3 3 v3 h-24 Z" fill="' + c.accent + '"/>' +
      '<path d="M65 50 l2 4 2 -4 M73 50 l2 4 2 -4" stroke="#fff" stroke-width="1.6" fill="none"/>' +
      '<path d="M52 56 l9 5" stroke="' + c.accent + '" stroke-width="5" stroke-linecap="round"/>' +
      legs(c, [38, 52], 78, 15) +
      '<circle cx="67" cy="33" r="3" fill="' + EYE + '"/>'),
    stego: (c) => SVG(
      '<path d="M78 62 Q94 60 92 50" stroke="' + c.accent + '" stroke-width="8" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="52" cy="64" rx="28" ry="15" fill="' + c.accent + '"/>' +
      '<circle cx="24" cy="58" r="10" fill="' + c.accent + '"/>' +
      '<path d="M36 52 l5 -13 5 13 Z M48 50 l5 -14 5 14 Z M60 52 l5 -13 5 13 Z" fill="' + c.deep + '"/>' +
      legs(c, [40, 60], 76, 15) +
      '<circle cx="21" cy="56" r="2.4" fill="' + EYE + '"/>'),
    trike: (c) => SVG(
      '<path d="M80 62 Q94 60 92 50" stroke="' + c.accent + '" stroke-width="8" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="56" cy="64" rx="25" ry="15" fill="' + c.accent + '"/>' +
      '<path d="M31 42 a15 15 0 0 0 0 30 Z" fill="' + c.deep + '"/>' +
      '<circle cx="31" cy="57" r="13" fill="' + c.accent + '"/>' +
      '<path d="M24 47 l-3 -13 9 9 Z M36 45 l-1 -14 8 10 Z" fill="' + c.deep + '"/><path d="M18 60 l-10 -3 8 7 Z" fill="' + c.deep + '"/>' +
      legs(c, [48, 66], 76, 15) +
      '<circle cx="28" cy="55" r="2.4" fill="' + EYE + '"/>'),
    raptor: (c) => SVG(
      '<path d="M24 62 Q6 60 6 76" stroke="' + c.accent + '" stroke-width="9" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="46" cy="62" rx="22" ry="15" fill="' + c.accent + '"/>' +
      '<path d="M60 62 Q74 54 70 40" stroke="' + c.accent + '" stroke-width="14" fill="none" stroke-linecap="round"/>' +
      '<circle cx="71" cy="37" r="11" fill="' + c.accent + '"/>' +
      '<path d="M79 37 h10 v5 h-11 Z" fill="' + c.accent + '"/>' +
      '<path d="M67 27 l-4 -10 10 6 Z" fill="' + c.deep + '"/>' +
      legs(c, [40, 52], 74, 16) +
      '<circle cx="74" cy="35" r="2.6" fill="' + EYE + '"/>'),
    anky: (c) => SVG(
      '<path d="M74 62 Q90 60 92 68" stroke="' + c.accent + '" stroke-width="8" fill="none" stroke-linecap="round"/>' +
      '<circle cx="92" cy="68" r="7" fill="' + c.deep + '"/>' +
      '<ellipse cx="48" cy="62" rx="27" ry="17" fill="' + c.accent + '"/>' +
      '<circle cx="22" cy="62" r="10" fill="' + c.accent + '"/>' +
      '<circle cx="38" cy="48" r="4.5" fill="' + c.deep + '"/><circle cx="50" cy="46" r="5" fill="' + c.deep + '"/><circle cx="62" cy="48" r="4.5" fill="' + c.deep + '"/>' +
      legs(c, [38, 58], 76, 14) +
      '<circle cx="19" cy="60" r="2.4" fill="' + EYE + '"/>'),
  };

  // 🐙 עולם הים
  const SEA = {
    fish: (c) => SVG(
      '<path d="M20 50 L40 32 L40 68 Z" fill="' + c.deep + '"/>' +
      '<ellipse cx="60" cy="50" rx="30" ry="22" fill="' + c.accent + '"/>' +
      '<path d="M58 28 q10 4 8 14" stroke="' + c.deep + '" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<circle cx="74" cy="46" r="5.5" fill="#fff"/><circle cx="75" cy="46" r="2.6" fill="' + EYE + '"/>' +
      '<path d="M78 56 q5 4 8 1" stroke="' + EYE + '" stroke-width="2" fill="none" stroke-linecap="round"/>'),
    whale: (c) => SVG(
      '<ellipse cx="50" cy="58" rx="36" ry="24" fill="' + c.accent + '"/>' +
      '<path d="M84 44 l14 -8 -3 17 Z" fill="' + c.deep + '"/>' +
      '<path d="M18 66 q32 16 62 0 q-32 -4 -62 0 Z" fill="#fff"/>' +
      '<circle cx="34" cy="52" r="4.6" fill="' + EYE + '"/>' +
      '<path d="M28 62 q7 5 14 1" stroke="' + EYE + '" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<path d="M22 40 v-10 M30 40 v-14 M38 40 v-10" stroke="' + c.deep + '" stroke-width="2.4" stroke-linecap="round"/>'),
    octopus: (c) => SVG(
      '<path d="M24 56 a26 24 0 0 1 52 0 v6 q-4 8 -8 0 q-4 8 -8 0 q-4 8 -8 0 q-4 8 -8 0 q-4 8 -8 0 q-4 8 -8 0 Z" fill="' + c.accent + '"/>' +
      '<circle cx="40" cy="50" r="6" fill="#fff"/><circle cx="60" cy="50" r="6" fill="#fff"/>' +
      '<circle cx="41" cy="51" r="3" fill="' + EYE + '"/><circle cx="59" cy="51" r="3" fill="' + EYE + '"/>' +
      '<path d="M43 62 q7 5 14 0" stroke="' + EYE + '" stroke-width="2" fill="none" stroke-linecap="round"/>'),
    crab: (c) => SVG(
      '<ellipse cx="50" cy="60" rx="28" ry="19" fill="' + c.accent + '"/>' +
      '<path d="M24 54 q-14 -6 -10 -18 q10 2 12 12 M76 54 q14 -6 10 -18 q-10 2 -12 12" fill="' + c.accent + '"/>' +
      '<path d="M30 74 l-8 8 M50 78 v9 M70 74 l8 8" stroke="' + c.deep + '" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="42" cy="50" r="5" fill="#fff"/><circle cx="58" cy="50" r="5" fill="#fff"/>' +
      '<circle cx="42" cy="50" r="2.4" fill="' + EYE + '"/><circle cx="58" cy="50" r="2.4" fill="' + EYE + '"/>' +
      '<path d="M42 64 q8 5 16 0" stroke="' + EYE + '" stroke-width="2" fill="none" stroke-linecap="round"/>'),
    star: (c) => SVG(
      starInner(46, 20, c.accent) +
      '<circle cx="43" cy="52" r="3.4" fill="' + EYE + '"/><circle cx="57" cy="52" r="3.4" fill="' + EYE + '"/>' +
      '<path d="M43 60 q7 5 14 0" stroke="' + EYE + '" stroke-width="2" fill="none" stroke-linecap="round"/>'),
    turtle: (c) => SVG(
      '<circle cx="82" cy="56" r="9" fill="' + c.deep + '"/>' +
      '<ellipse cx="26" cy="42" rx="7" ry="4.5" fill="' + c.deep + '"/><ellipse cx="26" cy="72" rx="7" ry="4.5" fill="' + c.deep + '"/>' +
      '<ellipse cx="70" cy="40" rx="6.5" ry="4.5" fill="' + c.deep + '"/><ellipse cx="70" cy="74" rx="6.5" ry="4.5" fill="' + c.deep + '"/>' +
      '<ellipse cx="48" cy="56" rx="27" ry="22" fill="' + c.accent + '"/>' +
      '<path d="M48 34 v44 M23 50 q25 12 50 0 M27 66 q21 8 42 0" stroke="' + c.deep + '" stroke-width="2.2" fill="none" opacity=".5"/>' +
      '<circle cx="85" cy="54" r="2" fill="#fff"/>'),
  };

  // 🚗 כלי תחבורה
  const wheels = (c, xs, y) => xs.map((x) => '<circle cx="' + x + '" cy="' + y + '" r="8" fill="' + EYE + '"/><circle cx="' + x + '" cy="' + y + '" r="3.4" fill="#fff"/>').join('');
  const VEHICLES = {
    car: (c) => SVG(
      '<path d="M12 62 L18 48 Q22 40 34 40 L64 40 Q74 40 80 48 L88 58 L88 66 L12 66 Z" fill="' + c.accent + '"/>' +
      '<path d="M28 46 h16 v10 h-20 Z M50 46 h14 q6 0 9 6 l3 4 h-26 Z" fill="#fff" opacity=".85"/>' +
      wheels(c, [30, 70], 68)),
    bus: (c) => SVG(
      '<rect x="14" y="26" width="72" height="42" rx="9" fill="' + c.accent + '"/>' +
      '<rect x="20" y="33" width="60" height="16" rx="4" fill="#fff" opacity=".85"/>' +
      '<path d="M32 33 v16 M46 33 v16 M60 33 v16" stroke="' + c.accent + '" stroke-width="3"/>' +
      '<circle cx="80" cy="58" r="3" fill="#FFD23F"/>' + wheels(c, [30, 70], 70)),
    truck: (c) => SVG(
      '<rect x="12" y="34" width="42" height="30" rx="4" fill="' + c.accent + '"/>' +
      '<path d="M54 44 h18 l12 12 v8 H54 Z" fill="' + c.deep + '"/>' +
      '<rect x="58" y="47" width="12" height="9" rx="2" fill="#fff" opacity=".85"/>' +
      wheels(c, [26, 66, 80], 66)),
    train: (c) => SVG(
      '<rect x="18" y="34" width="52" height="34" rx="6" fill="' + c.accent + '"/>' +
      '<rect x="60" y="24" width="12" height="14" rx="3" fill="' + c.deep + '"/>' +
      '<rect x="26" y="40" width="16" height="14" rx="3" fill="#fff" opacity=".85"/>' +
      '<circle cx="66" cy="20" r="5" fill="#fff" opacity=".7"/><circle cx="56" cy="16" r="4" fill="#fff" opacity=".55"/>' +
      wheels(c, [30, 58], 70)),
    plane: (c) => SVG(
      '<path d="M14 52 Q30 44 74 46 L86 50 L74 56 Q30 60 14 52 Z" fill="' + c.accent + '"/>' +
      '<path d="M40 48 L54 26 L60 28 L52 50 Z" fill="' + c.deep + '"/>' +
      '<path d="M40 54 L52 74 L58 72 L54 52 Z" fill="' + c.deep + '"/>' +
      '<path d="M74 42 L84 34 L84 46 Z" fill="' + c.deep + '"/>' +
      '<circle cx="34" cy="51" r="3" fill="#fff"/><circle cx="46" cy="51" r="3" fill="#fff"/><circle cx="58" cy="51" r="3" fill="#fff"/>'),
    boat: (c) => SVG(
      '<path d="M18 60 L82 60 L72 76 L28 76 Z" fill="' + c.deep + '"/>' +
      '<path d="M50 16 L50 56 L20 56 Z" fill="' + c.accent + '"/>' +
      '<path d="M54 20 L54 56 L78 56 Z" fill="#fff"/>' +
      '<rect x="48" y="14" width="4" height="44" rx="2" fill="' + EYE + '"/>' +
      '<path d="M10 80 q10 -6 20 0 q10 6 20 0 q10 -6 20 0 q10 6 20 0" stroke="' + c.accent + '" stroke-width="3" fill="none" opacity=".5"/>'),
  };

  // 🍓 אוכל / פירות
  const seedsOn = (pts, fill) => pts.map((p) => '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="1.4" ry="2.2" fill="' + fill + '"/>').join('');
  const FOOD = {
    strawberry: (c) => SVG(
      '<path d="M50 90 C28 74 20 54 28 42 C36 32 64 32 72 42 C80 54 72 74 50 90 Z" fill="' + c.accent + '"/>' +
      '<path d="M34 40 q6 -12 16 -14 q10 2 16 14 q-16 8 -32 0 Z" fill="#3FA34D"/>' +
      '<rect x="48" y="20" width="4" height="10" rx="2" fill="#3FA34D"/>' +
      seedsOn([[42, 52], [58, 52], [50, 60], [36, 62], [64, 62], [45, 70], [55, 70]], '#fff')),
    apple: (c) => SVG(
      '<path d="M50 34 C40 24 22 30 22 50 C22 72 40 84 50 84 C60 84 78 72 78 50 C78 30 60 24 50 34 Z" fill="' + c.accent + '"/>' +
      '<path d="M50 34 q2 -12 -2 -18" stroke="#7A4A1E" stroke-width="4" fill="none" stroke-linecap="round"/>' +
      '<path d="M50 24 q12 -10 20 -2 q-8 12 -20 6 Z" fill="#3FA34D"/>' +
      '<ellipse cx="38" cy="48" rx="5" ry="8" fill="#fff" opacity=".45"/>'),
    watermelon: (c) => SVG(
      '<path d="M12 38 A38 38 0 0 0 88 38 Z" fill="' + c.deep + '"/>' +
      '<path d="M17 38 A33 33 0 0 0 83 38 Z" fill="#fff"/>' +
      '<path d="M22 38 A28 28 0 0 0 78 38 Z" fill="' + c.accent + '"/>' +
      seedsOn([[40, 46], [52, 44], [62, 50], [46, 56], [58, 60], [50, 64]], EYE)),
    icecream: (c) => SVG(
      '<path d="M36 50 L64 50 L50 92 Z" fill="#E0A96D"/>' +
      '<path d="M38 52 h24 M42 62 h16" stroke="#B9824A" stroke-width="2" opacity=".6"/>' +
      '<circle cx="42" cy="42" r="15" fill="' + c.accent + '"/><circle cx="58" cy="42" r="15" fill="' + c.deep + '"/>' +
      '<circle cx="50" cy="30" r="14" fill="' + c.accent + '"/>' +
      '<circle cx="50" cy="18" r="4" fill="#FF5D73"/>'),
    cupcake: (c) => SVG(
      '<path d="M28 56 L72 56 L66 84 Q50 90 34 84 Z" fill="' + c.deep + '"/>' +
      '<path d="M34 60 v22 M42 60 v24 M50 60 v25 M58 60 v24 M66 60 v22" stroke="#fff" stroke-width="1.6" opacity=".4"/>' +
      '<path d="M30 56 Q30 30 50 30 Q70 30 70 56 Q60 48 50 56 Q40 48 30 56 Z" fill="' + c.accent + '"/>' +
      '<circle cx="50" cy="24" r="5" fill="#FF5D73"/>'),
    donut: (c) => SVG(
      '<circle cx="50" cy="52" r="32" fill="' + c.accent + '"/>' +
      '<path d="M20 46 q10 -10 22 -6 q10 -8 22 -2 q10 -4 16 6 q-6 10 -16 6 q-12 8 -22 2 q-12 4 -22 -6 Z" fill="' + c.deep + '"/>' +
      '<circle cx="50" cy="52" r="12" fill="#fff"/>' +
      '<path d="M38 40 l4 5 M56 38 l3 6 M46 34 l2 6 M62 46 l5 3 M34 50 l6 2" stroke="#FFD23F" stroke-width="2.6" stroke-linecap="round"/>'),
  };

  const SETS = {
    animals: ANIMAL_TYPES.map((t) => ANIMALS[t]),
    dinosaurs: Object.keys(DINOS).map((k) => DINOS[k]),
    sea: Object.keys(SEA).map((k) => SEA[k]),
    vehicles: Object.keys(VEHICLES).map((k) => VEHICLES[k]),
    food: Object.keys(FOOD).map((k) => FOOD[k]),
  };
  const iconSvg = (set, i, c) => { const arr = SETS[set] || SETS.animals; return arr[i % arr.length](c); };
  const BADGE_SETS = ['animals', 'dinosaurs', 'sea', 'vehicles', 'food'];

  const rocketSvg = (c) => SVG(
    '<path d="M50 6 C64 18 68 40 66 60 H34 C32 40 36 18 50 6 Z" fill="#fff"/>' +
    '<circle cx="50" cy="34" r="9" fill="' + c.accent + '"/><circle cx="50" cy="34" r="4.5" fill="' + c.deep + '"/>' +
    '<path d="M34 54 L20 70 L34 66 Z" fill="' + c.accent + '"/><path d="M66 54 L80 70 L66 66 Z" fill="' + c.accent + '"/>' +
    '<path d="M42 66 h16 l-4 12 h-8 Z" fill="' + c.deep + '"/>' +
    '<path d="M46 80 q4 12 8 0 q-4 -4 -8 0 Z" fill="#FFD23F"/><path d="M48 80 q2 8 4 0 Z" fill="#FF8A3D"/>');

  const planetSvg = (c) => SVG(
    '<ellipse cx="50" cy="52" rx="46" ry="14" fill="none" stroke="' + c.deep + '" stroke-width="6" opacity=".75"/>' +
    '<circle cx="50" cy="52" r="26" fill="' + c.accent + '"/>' +
    '<circle cx="40" cy="46" r="5" fill="#fff" opacity=".6"/><circle cx="58" cy="58" r="3.5" fill="#fff" opacity=".5"/>');

  const shieldSvg = (c) => SVG(
    '<path d="M50 6 L86 18 V46 C86 70 68 86 50 94 C32 86 14 70 14 46 V18 Z" fill="' + c.accent + '" stroke="#fff" stroke-width="5"/>' +
    '<path d="M50 6 L86 18 V46 C86 70 68 86 50 94 C32 86 14 70 14 46 V18 Z" fill="none" stroke="' + c.deep + '" stroke-width="2"/>');

  const sunburstSvg = (c) => {
    let rays = '';
    for (let a = 0; a < 360; a += 30) {
      const r = (a * Math.PI) / 180, w = 0.17;
      const x1 = 50 + 70 * Math.cos(r - w), y1 = 50 + 70 * Math.sin(r - w);
      const x2 = 50 + 70 * Math.cos(r + w), y2 = 50 + 70 * Math.sin(r + w);
      rays += '<path d="M50 50 L' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' L' + x2.toFixed(1) + ' ' + y2.toFixed(1) + ' Z" fill="' + c.deep + '" opacity=".5"/>';
    }
    return SVG(rays, ' preserveAspectRatio="xMidYMid slice"');
  };

  const starInner = (outerR, innerR, fill) => {
    const pts = [];
    for (let k = 0; k < 5; k++) {
      const o = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
      const i = o + Math.PI / 5;
      pts.push((50 + outerR * Math.cos(o)).toFixed(1) + ' ' + (50 + outerR * Math.sin(o)).toFixed(1));
      pts.push((50 + innerR * Math.cos(i)).toFixed(1) + ' ' + (50 + innerR * Math.sin(i)).toFixed(1));
    }
    return '<polygon points="' + pts.join(' ') + '" fill="' + fill + '" stroke-linejoin="round"/>';
  };
  const starSvg = (fill, extra) => SVG(starInner(46, 19, fill), extra);

  const rainbowSvg = () => {
    const cols = ['#FF5D73', '#FF8A3D', '#F5B012', '#22C56B', '#3D9BFF', '#9B5DE5'];
    let arcs = '';
    cols.forEach((col, k) => {
      const r = 42 - k * 6;
      arcs += '<path d="M' + (50 - r) + ' 62 A' + r + ' ' + r + ' 0 0 1 ' + (50 + r) + ' 62" fill="none" stroke="' + col + '" stroke-width="5.4" stroke-linecap="round"/>';
    });
    arcs += '<ellipse cx="24" cy="64" rx="13" ry="8" fill="#fff"/><ellipse cx="76" cy="64" rx="13" ry="8" fill="#fff"/>';
    return SVG(arcs);
  };

  const sparkle = (fill) =>
    '<span class="pc-sparkle">' + SVG('<path d="M50 8 C54 34 66 46 92 50 C66 54 54 66 50 92 C46 66 34 54 8 50 C34 46 46 34 50 8 Z" fill="' + fill + '"/>') + '</span>';

  const dots = (n, fill) => {
    let s = '';
    const pos = [[8, 20], [90, 14], [16, 82], [86, 74], [50, 6], [6, 52], [94, 46]];
    for (let k = 0; k < n && k < pos.length; k++)
      s += '<span class="pc-dot" style="left:' + pos[k][0] + '%;top:' + pos[k][1] + '%;background:' + fill + '"></span>';
    return s;
  };
  const stars = (fill) => {
    let s = '';
    const pos = [[10, 16, 1], [88, 12, .7], [22, 78, .8], [80, 82, 1], [50, 8, .6], [12, 50, .7], [92, 54, .9], [64, 24, .6]];
    pos.forEach((p) => { s += '<span class="pc-star" style="left:' + p[0] + '%;top:' + p[1] + '%;transform:translate(-50%,-50%) scale(' + p[2] + ')">' + starSvg(fill) + '</span>'; });
    return s;
  };

  // ---------- חלקים משותפים ----------
  function pinRow(value) {
    const chars = String(value == null ? '' : value).split('');
    const cl = chars.length > 8 ? ' small' : '';
    return '<div class="pc-pinrow">' + chars.map((c) => '<span class="pc-pin' + cl + '">' + esc(c) + '</span>').join('') + '</div>';
  }
  function creds(st) {
    return (
      '<div class="pc-creds">' +
      '<div class="pc-field"><div class="pc-flabel">קוד משתמש</div>' + pinRow(st.userCode) + '</div>' +
      '<div class="pc-field"><div class="pc-flabel">סיסמה</div>' + pinRow(st.password) + '</div>' +
      '</div>'
    );
  }
  const nameBlock = (st, cls, inst) =>
    '<div class="pc-name">' + esc(st.fullName) + '</div>' +
    '<div class="pc-meta">כיתה <b>' + esc(cls) + '</b>' + (inst ? ' · ' + esc(inst) : '') + '</div>';

  // ---------- Renderers לכל נושא ----------
  const card = (tpl, x, inner, back) =>
    '<div class="pc-card pc-tpl-' + tpl + (back ? ' pc-back' : '') + '" style="' + cstyle(x.c) + ';--text-scale:' + (x.ts || 1) + '">' + inner + '</div>';
  const head = (t) => '<div class="pc-backhead">' + t + '</div>';

  // 5 סטים חולקים פריסת "badge" אחת; רק האייקון משתנה
  const badgeTheme = (setName) => ({
    front: (st, x) => card('badgestyle', x,
      '<div class="pc-deco">' + dots(6, x.c.accent) + '</div>' +
      '<div class="pc-top"></div>' +
      '<div class="pc-hero"><div class="pc-badge">' + iconSvg(setName, x.idx, x.c) + '</div></div>' +
      '<div class="pc-info">' + nameBlock(st, x.cls, x.inst) + '</div>'),
    back: (st, x) => card('badgestyle', x,
      '<div class="pc-deco">' + dots(6, x.c.accent) + '</div>' + head('הכניסה שלי') + creds(st), true),
  });

  const THEMES = {
    animals: badgeTheme('animals'),
    dinosaurs: badgeTheme('dinosaurs'),
    sea: badgeTheme('sea'),
    vehicles: badgeTheme('vehicles'),
    food: badgeTheme('food'),
    space: {
      front: (st, x) => card('space', x,
        '<div class="pc-deco">' + stars('#fff') + '</div>' +
        '<div class="pc-hero"><span class="pc-planet">' + planetSvg(x.c) + '</span><span class="pc-rocket">' + rocketSvg(x.c) + '</span></div>' +
        '<div class="pc-eyebrow">טייס/ת החלל</div>' +
        '<div class="pc-info">' + nameBlock(st, x.cls, x.inst) + '</div>'),
      back: (st, x) => card('space', x,
        '<div class="pc-deco">' + stars('#fff') + '</div>' + head('קוד השיגור') + creds(st), true),
    },
    heroes: {
      front: (st, x) => card('heroes', x,
        '<div class="pc-burst">' + sunburstSvg(x.c) + '</div>' +
        '<div class="pc-hero"><div class="pc-emblem">' + shieldSvg(x.c) + '<span class="pc-initial">' + esc(initial(st)) + '</span></div></div>' +
        '<div class="pc-eyebrow">כרטיס גיבור/ה</div>' +
        '<div class="pc-info">' + nameBlock(st, x.cls, x.inst) + '</div>'),
      back: (st, x) => card('heroes', x,
        '<div class="pc-burst">' + sunburstSvg(x.c) + '</div>' + head('כוחות העל שלי') + creds(st), true),
    },
    rainbow: {
      front: (st, x) => card('rainbow', x,
        '<div class="pc-deco">' + sparkle(x.c.accent) + sparkle('#F5B012') + sparkle(x.c.deep) + '</div>' +
        '<div class="pc-hero"><span class="pc-rainbow">' + rainbowSvg() + '</span></div>' +
        '<div class="pc-info">' + nameBlock(st, x.cls, x.inst) + '</div>'),
      back: (st, x) => card('rainbow', x,
        '<div class="pc-deco">' + sparkle(x.c.accent) + sparkle('#F5B012') + sparkle(x.c.deep) + '</div>' + head('הקסם שלי') + creds(st), true),
    },
    // ⬜ פשוט — בלי איורים, מסגרת נקייה בצבע התלמיד. לילדים גדולים יותר / מי שרוצה משהו שקט.
    plain: {
      front: (st, x) => card('plain', x,
        '<div class="pc-info">' + nameBlock(st, x.cls, x.inst) + '</div>'),
      back: (st, x) => card('plain', x, head('פרטי התחברות') + creds(st), true),
    },
  };

  const blankCard = '<div class="pc-card pc-blank"></div>';

  function cardHtml(st, side, ctx) {
    if (!st) return blankCard;
    const theme = THEMES[ctx.template] || THEMES.animals;
    return (side === 'back' ? theme.back : theme.front)(st, ctx);
  }

  // side: 'front' (dir rtl) / 'back' (dir ltr — שיקוף אופקי להתלכדות דו-צדדית)
  function buildSheet(group, side, institution, className, opts, startIndex) {
    opts = norm(opts);
    const sz = sizeById(opts.size);
    const per = sz.cols * sz.rows;
    const sheet = document.createElement('div');
    sheet.className = 'pc-sheet pc-sheet-' + side + ' pc-tpl-' + opts.template + ' pc-size-' + opts.size;
    sheet.style.gridTemplateColumns = 'repeat(' + sz.cols + ',1fr)';
    sheet.style.gridTemplateRows = 'repeat(' + sz.rows + ',1fr)';
    let html = '';
    for (let i = 0; i < per; i++) {
      const st = group[i];
      const ctx = { inst: institution, cls: className, template: opts.template, c: colorForStudent((startIndex || 0) + i), idx: (startIndex || 0) + i, ts: opts.textScale };
      html += cardHtml(st, side, ctx);
    }
    sheet.innerHTML = html;
    return sheet;
  }

  function fitCards(container) {
    container.querySelectorAll('.pc-name').forEach((el) => {
      let size = parseFloat(getComputedStyle(el).fontSize), guard = 0;
      while (el.scrollWidth > el.clientWidth + 1 && size > 8 && guard < 40) { size -= 1; el.style.fontSize = size + 'px'; guard++; }
    });
    container.querySelectorAll('.pc-pinrow').forEach((row) => {
      const field = row.closest('.pc-field');
      if (field && row.scrollWidth > field.clientWidth + 1) row.querySelectorAll('.pc-pin').forEach((p) => p.classList.add('tiny'));
    });
  }

  function buildAllSheets(classes, opts) {
    opts = norm(opts);
    const sz = sizeById(opts.size), per = sz.cols * sz.rows;
    const sheets = [];
    for (const cls of classes) {
      const groups = chunk(cls.students, per);
      groups.forEach((group, gi) => {
        const start = gi * per;
        sheets.push({ el: buildSheet(group, 'front', cls.institution, cls.name, opts, start), side: 'front' });
        sheets.push({ el: buildSheet(group, 'back', cls.institution, cls.name, opts, start), side: 'back' });
      });
    }
    return sheets;
  }

  // ---------- תצוגה מקדימה (גדולה) ----------
  const FULL_U = { xl: 20, large: 15, medium: 12, small: 9, mini: 6.4, micro: 4.6 };
  function buildPreview(student, institution, className, opts, index) {
    opts = norm(opts);
    const sz = sizeById(opts.size);
    const cellW = (PAGE_W - 2 * MARGIN) / sz.cols, cellH = (PAGE_H - 2 * MARGIN) / sz.rows;
    const cardW = cellW - 3.2, cardH = cellH - 3.2; // mm
    // ככל שהכרטיס קטן — מגדילים יותר בתצוגה כדי שיישאר גדול וברור
    const SCALE = Math.max(0.62, Math.min(1.35, 172 / (cardW * PX_PER_MM)));
    const dispW = cardW * PX_PER_MM * SCALE, dispH = cardH * PX_PER_MM * SCALE;
    const u = (FULL_U[opts.size] || 12) * SCALE;
    const c = colorForStudent(index || 0);

    const row = document.createElement('div');
    row.className = 'pc-preview-row';
    [['חזית', 'front'], ['גב', 'back']].forEach(([lbl, side]) => {
      const holder = document.createElement('div');
      holder.className = 'pc-preview-holder';
      const box = document.createElement('div');
      box.className = 'pc-preview pc-tpl-' + opts.template + ' pc-size-' + opts.size;
      box.innerHTML = cardHtml(student, side, { inst: institution, cls: className, template: opts.template, c: c, idx: index || 0, ts: opts.textScale });
      const card = box.firstChild;
      card.style.width = dispW + 'px'; card.style.height = dispH + 'px'; card.style.margin = '0';
      card.style.setProperty('--u', u + 'px');
      const cap = document.createElement('div'); cap.className = 'pc-preview-cap'; cap.textContent = lbl;
      holder.appendChild(box); holder.appendChild(cap); row.appendChild(holder);
    });
    return row;
  }

  async function generate(classes, onProgress, opts) {
    opts = opts || {};
    const norml = norm(opts);
    const jsPDFctor = window.jspdf.jsPDF, html2canvas = window.html2canvas;
    const stage = document.createElement('div');
    stage.className = 'pc-stage';
    document.body.appendChild(stage);
    const sheets = buildAllSheets(classes, norml);
    sheets.forEach((s) => stage.appendChild(s.el));
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
    sheets.forEach((s) => fitCards(s.el));
    const doc = new jsPDFctor({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    for (let i = 0; i < sheets.length; i++) {
      if (onProgress) onProgress(i + 1, sheets.length);
      const canvas = await html2canvas(sheets[i].el, { scale: 3, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const img = canvas.toDataURL('image/jpeg', 0.95);
      if (i > 0) doc.addPage();
      doc.addImage(img, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    }
    document.body.removeChild(stage);
    if (opts.noSave) return doc.output('bloburl');
    doc.save('כרטיסי-סיסמה-' + new Date().toISOString().slice(0, 10) + '.pdf');
    return doc;
  }

  window.PasswordCards = Object.assign(window.PasswordCards || {}, {
    generate, buildPreview, fitCards, TEMPLATES, SIZES, PALETTE,
    _buildSheet: buildSheet,
  });
})();
