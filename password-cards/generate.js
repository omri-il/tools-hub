/* בניית גיליונות A4 של כרטיסיות + הפקת PDF דו-צדדי — הכל בדפדפן. */
(function () {
  'use strict';

  const PER_PAGE = 8; // 2 טורים × 4 שורות

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

  // כל תו בתיבה משלו — כמו קוד גישה/כרטיס טיסה. ברור לקריאה גם בצילום/הדפסה.
  function pinRow(value, extraClass) {
    const chars = String(value == null ? '' : value).split('');
    const small = chars.length > 8 ? ' small' : '';
    return (
      '<div class="pc-pinrow' + (extraClass ? ' ' + extraClass : '') + '">' +
      chars.map((c) => '<span class="pc-pin' + small + '">' + esc(c) + '</span>').join('') +
      '</div>'
    );
  }

  function frontCard(st, institution, className) {
    return (
      '<div class="pc-card">' +
      '<div class="pc-band">כרטיס כניסה אישי</div>' +
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

  function backCard(st) {
    return (
      '<div class="pc-card">' +
      '<div class="pc-band">פרטי התחברות</div>' +
      '<div class="pc-body">' +
      '<div class="pc-creds">' +
      '<div class="pc-field">' +
      '<div class="pc-flabel">קוד משתמש</div>' +
      pinRow(st.userCode) +
      '</div>' +
      '<div class="pc-field">' +
      '<div class="pc-flabel">סיסמה</div>' +
      pinRow(st.password, 'pc-pw') +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>'
    );
  }

  const blankCard = '<div class="pc-card pc-blank"></div>';

  // side: 'front' (dir rtl) או 'back' (dir ltr — שיקוף אופקי להתלכדות דו-צדדית)
  function buildSheet(group, side, institution, className) {
    const sheet = document.createElement('div');
    sheet.className = 'pc-sheet ' + (side === 'back' ? 'pc-sheet-back' : 'pc-sheet-front');
    let html = '';
    for (let i = 0; i < PER_PAGE; i++) {
      const st = group[i];
      if (!st) html += blankCard;
      else html += side === 'back' ? backCard(st) : frontCard(st, institution, className);
    }
    sheet.innerHTML = html;
    return sheet;
  }

  // הקטנת גופן אוטומטית לשמות ארוכים ולסיסמאות ארוכות כדי למנוע גלישה.
  function fitNames(container) {
    container.querySelectorAll('.pc-name').forEach((el) => {
      let size = parseFloat(getComputedStyle(el).fontSize);
      let guard = 0;
      while (el.scrollWidth > el.clientWidth + 1 && size > 9 && guard < 40) {
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

  // בונה את רצף הגיליונות: לכל כיתה, קבוצות של 8 → חזית ואז גב.
  function buildAllSheets(classes) {
    const sheets = []; // [{el, side}]
    for (const cls of classes) {
      const groups = chunk(cls.students, PER_PAGE);
      for (const group of groups) {
        sheets.push({ el: buildSheet(group, 'front', cls.institution, cls.name), side: 'front' });
        sheets.push({ el: buildSheet(group, 'back', cls.institution, cls.name), side: 'back' });
      }
    }
    return sheets;
  }

  async function generate(classes, onProgress, opts) {
    opts = opts || {};
    const jsPDFctor = window.jspdf.jsPDF;
    const html2canvas = window.html2canvas;

    const stage = document.createElement('div');
    stage.className = 'pc-stage';
    document.body.appendChild(stage);

    const sheets = buildAllSheets(classes);
    // צירוף כל הגיליונות ל-DOM כדי שהגופנים והפריסה יחושבו
    sheets.forEach((s) => stage.appendChild(s.el));

    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (e) {}
    }
    sheets.forEach((s) => fitNames(s.el));

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
    _buildSheet: buildSheet, // לבדיקות בלבד
  });
})();
