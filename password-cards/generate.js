/* בניית גיליונות A4 של כרטיסיות + הפקת PDF דו-צדדי — הכל בדפדפן.
   מבנה HTML אחד לכרטיס; הסגנון (template) והגודל (size) נקבעים ע"י מחלקות
   על ה"גיליון"/"תצוגה" ומעוצבים ב-CSS. הגדלים שומרים על שיקוף דו-צדדי תקין
   כי היפוך המיקומים נעשה ע"י dir (rtl בחזית / ltr בגב) לכל מספר טורים. */
(function () {
  'use strict';

  const TEMPLATES = [
    { id: 'passport', label: 'דרכון' },
    { id: 'badge', label: 'תג שם' },
    { id: 'ticket', label: 'כרטיס כניסה' },
    { id: 'playful', label: 'כיפי' },
    { id: 'minimal', label: 'מינימלי' },
  ];
  const SIZES = [
    { id: 'large', label: 'גדול', note: '6 בעמוד', cols: 2, rows: 3 },
    { id: 'medium', label: 'בינוני', note: '8 בעמוד', cols: 2, rows: 4 },
    { id: 'small', label: 'קטן', note: '12 בעמוד', cols: 3, rows: 4 },
  ];
  const BANDS = {
    passport: { front: 'כרטיס כניסה אישי', back: 'פרטי התחברות' },
    badge: { front: 'שלום, קוראים לי', back: 'פרטי התחברות' },
    ticket: { front: 'כרטיס כניסה', back: 'פרטי התחברות' },
    playful: { front: 'הכרטיס שלי', back: 'הסיסמה שלי' },
    minimal: { front: '', back: '' },
  };

  const PAGE_W = 210, PAGE_H = 297, MARGIN = 8; // mm
  const PX_PER_MM = 3.7795;

  function sizeById(id) {
    return SIZES.find((s) => s.id === id) || SIZES[1];
  }
  function norm(o) {
    return {
      template: (o && o.template) || 'passport',
      size: (o && o.size) || 'medium',
    };
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
    );
  }
  function chunk(arr, n) {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  }
  function initial(st) {
    const s = (st.fullName || '').trim();
    return s ? s[0] : '•';
  }

  // כל תו בתיבה משלו — קריא גם בהדפסה/צילום. עמודות מתעדכנות לפי הסגנון ב-CSS.
  function pinRow(value, extraClass) {
    const chars = String(value == null ? '' : value).split('');
    const small = chars.length > 8 ? ' small' : '';
    return (
      '<div class="pc-pinrow' + (extraClass ? ' ' + extraClass : '') + '">' +
      chars.map((c) => '<span class="pc-pin' + small + '">' + esc(c) + '</span>').join('') +
      '</div>'
    );
  }

  function frontCard(st, institution, className, tpl) {
    const band = (BANDS[tpl] || BANDS.passport).front;
    return (
      '<div class="pc-card">' +
      (band ? '<div class="pc-band">' + esc(band) + '</div>' : '') +
      '<div class="pc-body">' +
      '<div class="pc-avatar">' + esc(initial(st)) + '</div>' +
      '<div class="pc-idbox">' +
      '<div class="pc-val pc-name">' + esc(st.fullName) + '</div>' +
      '<div class="pc-meta">כיתה <b>' + esc(className) + '</b> · ' + esc(institution) + '</div>' +
      '</div>' +
      '</div>' +
      '<div class="pc-seal">מס״ד</div>' +
      '</div>'
    );
  }

  function backCard(st, tpl) {
    const band = (BANDS[tpl] || BANDS.passport).back;
    return (
      '<div class="pc-card">' +
      (band ? '<div class="pc-band">' + esc(band) + '</div>' : '') +
      '<div class="pc-body">' +
      '<div class="pc-creds">' +
      '<div class="pc-field"><div class="pc-flabel">קוד משתמש</div>' + pinRow(st.userCode) + '</div>' +
      '<div class="pc-field"><div class="pc-flabel">סיסמה</div>' + pinRow(st.password, 'pc-pw') + '</div>' +
      '</div>' +
      '</div>' +
      '</div>'
    );
  }

  const blankCard = '<div class="pc-card pc-blank"></div>';

  function cardHtml(st, side, institution, className, tpl) {
    if (!st) return blankCard;
    return side === 'back' ? backCard(st, tpl) : frontCard(st, institution, className, tpl);
  }

  // side: 'front' (dir rtl) או 'back' (dir ltr — שיקוף אופקי להתלכדות דו-צדדית)
  function buildSheet(group, side, institution, className, opts) {
    opts = norm(opts);
    const sz = sizeById(opts.size);
    const per = sz.cols * sz.rows;
    const sheet = document.createElement('div');
    sheet.className =
      'pc-sheet pc-sheet-' + side + ' pc-tpl-' + opts.template + ' pc-size-' + opts.size;
    sheet.style.gridTemplateColumns = 'repeat(' + sz.cols + ',1fr)';
    sheet.style.gridTemplateRows = 'repeat(' + sz.rows + ',1fr)';
    let html = '';
    for (let i = 0; i < per; i++) {
      html += cardHtml(group[i], side, institution, className, opts.template);
    }
    sheet.innerHTML = html;
    return sheet;
  }

  // הקטנת גופן אוטומטית לשמות ארוכים ולסיסמאות ארוכות כדי למנוע גלישה.
  function fitCards(container) {
    container.querySelectorAll('.pc-name').forEach((el) => {
      let size = parseFloat(getComputedStyle(el).fontSize);
      let guard = 0;
      while (el.scrollWidth > el.clientWidth + 1 && size > 8 && guard < 40) {
        size -= 1;
        el.style.fontSize = size + 'px';
        guard++;
      }
    });
    container.querySelectorAll('.pc-pinrow.pc-pw').forEach((row) => {
      const field = row.closest('.pc-field');
      if (field && row.scrollWidth > field.clientWidth + 1) {
        row.querySelectorAll('.pc-pin').forEach((p) => p.classList.add('tiny'));
      }
    });
  }

  function buildAllSheets(classes, opts) {
    opts = norm(opts);
    const sz = sizeById(opts.size);
    const per = sz.cols * sz.rows;
    const sheets = [];
    for (const cls of classes) {
      const groups = chunk(cls.students, per);
      for (const group of groups) {
        sheets.push({ el: buildSheet(group, 'front', cls.institution, cls.name, opts), side: 'front' });
        sheets.push({ el: buildSheet(group, 'back', cls.institution, cls.name, opts), side: 'back' });
      }
    }
    return sheets;
  }

  // ה--u המלא לכל גודל (חייב להתאים ל-CSS ‎.pc-size-*)
  const FULL_U = { large: 15, medium: 12, small: 8.6 };

  // תצוגה מקדימה: זוג כרטיסים (חזית + גב) בגודל תצוגה קטן — מרונדר נייטיב
  // (בלי transform, כדי שתיבת-הפריסה תשווה לגודל הנראה ולא תגלוש).
  function buildPreview(student, institution, className, opts) {
    opts = norm(opts);
    const sz = sizeById(opts.size);
    const cellW = (PAGE_W - 2 * MARGIN) / sz.cols;
    const cellH = (PAGE_H - 2 * MARGIN) / sz.rows;
    const cardW = cellW - 3.2, cardH = cellH - 3.2; // mm
    const SCALE = 0.52; // גורם הקטנה לתצוגה — שומר על גדלים יחסיים בין הסגנונות
    const dispW = cardW * PX_PER_MM * SCALE;
    const dispH = cardH * PX_PER_MM * SCALE;
    const u = (FULL_U[opts.size] || 12) * SCALE;

    const row = document.createElement('div');
    row.className = 'pc-preview-row';
    [['חזית', 'front'], ['גב', 'back']].forEach(([lbl, side]) => {
      const holder = document.createElement('div');
      holder.className = 'pc-preview-holder';

      const box = document.createElement('div');
      box.className = 'pc-preview pc-tpl-' + opts.template + ' pc-size-' + opts.size;
      box.innerHTML = cardHtml(student, side, institution, className, opts.template);
      const card = box.firstChild;
      card.style.width = dispW + 'px';
      card.style.height = dispH + 'px';
      card.style.margin = '0';
      card.style.setProperty('--u', u + 'px');

      const cap = document.createElement('div');
      cap.className = 'pc-preview-cap';
      cap.textContent = lbl;

      holder.appendChild(box);
      holder.appendChild(cap);
      row.appendChild(holder);
    });
    return row;
  }

  async function generate(classes, onProgress, opts) {
    opts = opts || {};
    const norml = norm(opts);
    const jsPDFctor = window.jspdf.jsPDF;
    const html2canvas = window.html2canvas;

    const stage = document.createElement('div');
    stage.className = 'pc-stage';
    document.body.appendChild(stage);

    const sheets = buildAllSheets(classes, norml);
    sheets.forEach((s) => stage.appendChild(s.el)); // ל-DOM כדי שהפריסה תחושב

    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (e) {}
    }
    sheets.forEach((s) => fitCards(s.el));

    const doc = new jsPDFctor({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    for (let i = 0; i < sheets.length; i++) {
      if (onProgress) onProgress(i + 1, sheets.length);
      const canvas = await html2canvas(sheets[i].el, {
        scale: 3,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      const img = canvas.toDataURL('image/jpeg', 0.95);
      if (i > 0) doc.addPage();
      doc.addImage(img, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    }

    document.body.removeChild(stage);

    if (opts.noSave) return doc.output('bloburl');
    const stamp = new Date().toISOString().slice(0, 10);
    doc.save('כרטיסי-סיסמה-' + stamp + '.pdf');
    return doc;
  }

  window.PasswordCards = Object.assign(window.PasswordCards || {}, {
    generate,
    buildPreview,
    fitCards,
    TEMPLATES,
    SIZES,
    _buildSheet: buildSheet, // לבדיקות
  });
})();
