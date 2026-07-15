/* בניית גיליונות A4 של כרטיסיות + הפקת PDF דו-צדדי — הכל בדפדפן. */
(function () {
  'use strict';

  const LOGIN_SITE = (window.PasswordCards && window.PasswordCards.LOGIN_SITE) || 'edu.gov.il';
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

  function frontCard(st, institution, className) {
    return (
      '<div class="pc-card">' +
      '<div class="pc-head">הזדהות משרד החינוך</div>' +
      '<div class="pc-body">' +
      '<div class="pc-line"><span class="pc-lbl">שם התלמיד</span><span class="pc-val pc-name">' +
      esc(st.fullName) +
      '</span></div>' +
      '<div class="pc-line"><span class="pc-lbl">כיתה</span><span class="pc-val">' +
      esc(className) +
      '</span></div>' +
      '<div class="pc-line"><span class="pc-lbl">מוסד</span><span class="pc-val">' +
      esc(institution) +
      '</span></div>' +
      '</div></div>'
    );
  }

  function backCard(st) {
    return (
      '<div class="pc-card pc-card-back">' +
      '<div class="pc-head">פרטי התחברות</div>' +
      '<div class="pc-body">' +
      '<div class="pc-line"><span class="pc-lbl">קוד משתמש</span><span class="pc-val pc-mono">' +
      esc(st.userCode) +
      '</span></div>' +
      '<div class="pc-line"><span class="pc-lbl">סיסמה</span><span class="pc-val pc-mono pc-pw">' +
      esc(st.password) +
      '</span></div>' +
      '<div class="pc-line pc-login"><span class="pc-lbl">אתר כניסה</span><span class="pc-val pc-mono">' +
      esc(LOGIN_SITE) +
      '</span></div>' +
      '</div></div>'
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

  // הקטנת גופן אוטומטית לשמות ארוכים כדי למנוע גלישה.
  function fitNames(container) {
    container.querySelectorAll('.pc-name, .pc-pw').forEach((el) => {
      let size = parseFloat(getComputedStyle(el).fontSize);
      let guard = 0;
      while ((el.scrollWidth > el.clientWidth + 1) && size > 9 && guard < 40) {
        size -= 1;
        el.style.fontSize = size + 'px';
        guard++;
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
