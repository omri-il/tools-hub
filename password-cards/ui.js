/* חיווט ה-UI: העלאה → פענוח → בחירת כיתות → תצוגה מקדימה → ייצוא. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let parsed = null;

  const drop = $('drop');
  const fileInput = $('file');
  const statusEl = $('status');
  const resultSection = $('result');
  const clsList = $('clsList');
  const previewWrap = $('previewWrap');
  const exportBtn = $('exportBtn');
  const progressEl = $('progress');
  const tplChooser = $('tplChooser');
  const sizeChooser = $('sizeChooser');
  const cardPreview = $('cardPreview');
  const textScaleEl = $('textScale');
  const tsVal = $('tsVal');

  // בחירת עיצוב הכרטיס (נשלחת ל-generate ומזינה את התצוגה החיה)
  const cardOpts = { template: 'animals', size: 'medium', textScale: 1.15 };

  function setStatus(msg, kind) {
    statusEl.className = 'status' + (kind ? ' ' + kind : '');
    statusEl.textContent = msg;
  }

  // צבע קבוע לכל כיתה — אותו צבע חוזר על התג ועל בועות השם בתצוגה המקדימה.
  const PALETTE = ['--sky', '--bubble', '--mint', '--sun', '--grape'];
  const classColor = (i) => 'var(' + PALETTE[i % PALETTE.length] + ')';
  const initial = (name) => (name || '•').trim()[0] || '•';

  // ---- העלאה ----
  drop.addEventListener('click', () => fileInput.click());
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('drag');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('drag');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  async function handleFile(file) {
    resultSection.classList.add('hidden');
    parsed = null;
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      setStatus('אפשר להעלות רק קובץ PDF. הקובץ שנבחר אינו PDF.', 'err');
      return;
    }
    setStatus('מפענח את הקובץ…', 'work');
    try {
      const buf = await file.arrayBuffer();
      const res = await window.PasswordCards.parse(buf);
      if (!res.valid) {
        setStatus(
          'מבנה הקובץ אינו מוכר. אנא ודא שהעלית את קובץ ה-PDF המקור שהורד ממערכת הסיסמאות של משרד החינוך.',
          'err'
        );
        return;
      }
      parsed = res;
      setStatus('הקובץ פוענח בהצלחה! ✓', 'ok');
      renderResult(res);
    } catch (err) {
      console.error(err);
      setStatus('אירעה שגיאה בקריאת הקובץ. ודא שהקובץ תקין ונסה שוב.', 'err');
    }
  }

  // ---- בחירת כיתות + תצוגה מקדימה ----
  function renderResult(res) {
    const inst = res.institution || '—';
    const parts = res.classes
      .map((c) => c.name + ' — ' + c.students.length + ' תלמידים')
      .join(', ');
    $('summaryHead').innerHTML =
      'מצאנו: בית ספר <b>' +
      escapeHtml(inst) +
      '</b>, ' +
      res.classes.length +
      ' כיתות (' +
      escapeHtml(parts) +
      ')';

    clsList.innerHTML = res.classes
      .map(
        (c, i) =>
          '<label class="cls-chip" style="--chip:' +
          classColor(i) +
          '"><input type="checkbox" class="cls-cb" data-i="' +
          i +
          '" checked><span class="cls-dot"></span><span class="cls-name">כיתה ' +
          escapeHtml(c.name) +
          '</span><span class="cls-count">' +
          c.students.length +
          ' תלמידים</span></label>'
      )
      .join('');

    if (res.classes.length === 1) $('clsCard').classList.add('hidden');
    else $('clsCard').classList.remove('hidden');

    renderPreview(res);
    buildChoosers();
    renderCardPreview();
    resultSection.classList.remove('hidden');
    clsList.querySelectorAll('.cls-cb').forEach((cb) =>
      cb.addEventListener('change', () => {
        cb.closest('.cls-chip').classList.toggle('off', !cb.checked);
        renderPreview(res);
        renderCardPreview();
      })
    );
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ---- עיצוב הכרטיס: בוחרים + תצוגה חיה ----
  let choosersBuilt = false;
  function chip(kind, item, selId) {
    const sub = item.note ? '<small>' + escapeHtml(item.note) + '</small>' : '';
    return (
      '<button type="button" class="opt-chip' +
      (item.id === selId ? ' sel' : '') +
      '" data-kind="' + kind + '" data-id="' + item.id + '">' +
      escapeHtml(item.label) + sub +
      '</button>'
    );
  }
  function buildChoosers() {
    if (choosersBuilt) return;
    tplChooser.innerHTML = window.PasswordCards.TEMPLATES.map((t) => chip('template', t, cardOpts.template)).join('');
    sizeChooser.innerHTML = window.PasswordCards.SIZES.map((s) => chip('size', s, cardOpts.size)).join('');
    [tplChooser, sizeChooser].forEach((box) =>
      box.addEventListener('click', (e) => {
        const btn = e.target.closest('.opt-chip');
        if (!btn) return;
        cardOpts[btn.dataset.kind] = btn.dataset.id;
        box.querySelectorAll('.opt-chip').forEach((c) => c.classList.toggle('sel', c === btn));
        renderCardPreview();
      })
    );
    textScaleEl.value = String(cardOpts.textScale);
    updateTsLabel();
    textScaleEl.addEventListener('input', () => {
      cardOpts.textScale = parseFloat(textScaleEl.value);
      updateTsLabel();
      renderCardPreview();
    });
    choosersBuilt = true;
  }
  function updateTsLabel() {
    if (tsVal) tsVal.textContent = Math.round(cardOpts.textScale * 100) + '%';
  }

  // הודעת ה"קשת" מתארת את הסגנון שנבחר בפועל — בסגנונות עם סט אייקונים
  // מתחלף (חיות/דינוזאורים/ים/תחבורה/אוכל) גם האייקון משתנה, לא רק הצבע.
  const HINTS = {
    animals: '🐾 כל תלמיד/ה מקבל/ת חיה וצבע משלו/ה',
    dinosaurs: '🦕 כל תלמיד/ה מקבל/ת דינוזאור וצבע משלו/ה',
    sea: '🐙 כל תלמיד/ה מקבל/ת יצור ים וצבע משלו/ה',
    vehicles: '🚗 כל תלמיד/ה מקבל/ת כלי רכב וצבע משלו/ה',
    food: '🍓 כל תלמיד/ה מקבל/ת מאכל וצבע משלו/ה',
    space: '🚀 כל תלמיד/ה מקבל/ת צבע חלל משלו/ה',
    heroes: '🦸 כל תלמיד/ה מקבל/ת צבע גיבור/ה משלו/ה',
    rainbow: '🌈 כל תלמיד/ה מקבל/ת גוון קשת משלו/ה',
    plain: '⬜ כרטיס נקי ופשוט — כל תלמיד/ה עם צבע מסגרת משלו/ה',
  };

  const DEMO = { fullName: 'ישראל ישראלי', userCode: '7000000', password: '123456', birthDate: '' };
  function sampleStudent() {
    const cls = selectedClasses()[0] || (parsed && parsed.classes[0]);
    const st = cls && cls.students[0];
    return {
      student: st || DEMO,
      inst: (parsed && parsed.institution) || 'בית הספר',
      cls: (cls && cls.name) || 'א',
    };
  }
  function renderCardPreview() {
    if (!parsed) return;
    const s = sampleStudent();
    cardPreview.innerHTML = '';
    const row = window.PasswordCards.buildPreview(s.student, s.inst, s.cls, cardOpts, 0);
    cardPreview.appendChild(row);
    // רצועת "כיתת קשת" — כל תלמיד מקבל צבע אחר
    const pal = window.PasswordCards.PALETTE || [];
    const sw = pal.map((c) => '<span class="pc-swatch" style="background:' + c.accent + '"></span>').join('');
    const strip = document.createElement('div');
    strip.innerHTML =
      '<div class="pc-hint">' + (HINTS[cardOpts.template] || HINTS.animals) + '</div>' +
      '<div class="pc-swatches">' + sw + '</div>';
    cardPreview.appendChild(strip);
    window.PasswordCards.fitCards(cardPreview);
  }

  function checkedIndexes() {
    return Array.from(clsList.querySelectorAll('.cls-cb'))
      .filter((cb) => cb.checked)
      .map((cb) => +cb.dataset.i);
  }

  function selectedClasses() {
    if (!parsed) return [];
    const idxs = new Set(checkedIndexes());
    return parsed.classes.filter((_, i) => idxs.has(i));
  }

  function editCell(ci, si, field, value, extraClass) {
    return (
      '<input class="edit-cell' +
      (extraClass ? ' ' + extraClass : '') +
      '" data-ci="' +
      ci +
      '" data-si="' +
      si +
      '" data-field="' +
      field +
      '" value="' +
      escapeHtml(value) +
      '" autocomplete="off" spellcheck="false">'
    );
  }

  function renderPreview(res) {
    const idxs = checkedIndexes();
    const rows = [];
    idxs.forEach((i) => {
      const c = res.classes[i];
      if (!c) return;
      c.students.forEach((s, si) => {
        rows.push(
          '<tr><td>' +
            escapeHtml(c.name) +
            '</td><td><span class="avatar" style="--chip:' +
            classColor(i) +
            '">' +
            escapeHtml(initial(s.fullName)) +
            '</span>' +
            editCell(i, si, 'fullName', s.fullName) +
            '</td><td class="mono">' +
            editCell(i, si, 'userCode', s.userCode) +
            '</td><td class="mono">' +
            editCell(i, si, 'password', s.password) +
            '</td><td class="mono">' +
            escapeHtml(s.birthDate || '') +
            '</td></tr>'
        );
      });
    });
    const total = rows.length;
    previewWrap.innerHTML =
      '<div class="tbl-scroll"><table><thead><tr><th>כיתה</th><th>שם התלמיד</th><th>קוד משתמש</th><th>סיסמה</th><th>תאריך לידה</th></tr></thead><tbody>' +
      rows.join('') +
      '</tbody></table></div>';
    exportBtn.disabled = total === 0;
    exportBtn.textContent = total
      ? 'הפק PDF להדפסה דו-צדדית (' + total + ' כרטיסיות)'
      : 'לא נבחרו תלמידים';
  }

  // עריכה חיה: כל שינוי בתא נשמר ישירות באובייקט התלמיד, כך שהכרטיס המופק
  // וגם בועת האות הראשונה מתעדכנים מיד ונשמרים גם אחרי סינון כיתות מחדש.
  previewWrap.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.classList.contains('edit-cell')) return;
    const ci = +el.dataset.ci;
    const si = +el.dataset.si;
    const field = el.dataset.field;
    const cls = parsed && parsed.classes[ci];
    const st = cls && cls.students[si];
    if (!st) return;
    st[field] = el.value;
    if (field === 'fullName') {
      const avatar = el.closest('tr').querySelector('.avatar');
      if (avatar) avatar.textContent = initial(el.value);
    }
    renderCardPreview(); // שיהיה תואם אם ערכתם את התלמיד שמוצג בתצוגה
  });

  // ---- ייצוא ----
  exportBtn.addEventListener('click', async () => {
    const classes = selectedClasses();
    if (!classes.length) return;
    exportBtn.disabled = true;
    progressEl.classList.remove('hidden');
    progressEl.textContent = 'מכין את הקובץ…';
    try {
      await window.PasswordCards.generate(
        classes,
        (done, total) => {
          progressEl.textContent = 'מעבד עמוד ' + done + ' מתוך ' + total + '…';
        },
        { template: cardOpts.template, size: cardOpts.size, textScale: cardOpts.textScale }
      );
      progressEl.textContent = 'הקובץ הורד בהצלחה ✓';
    } catch (err) {
      console.error(err);
      progressEl.textContent = 'אירעה שגיאה בהפקת ה-PDF. נסה שוב.';
    } finally {
      exportBtn.disabled = false;
    }
  });

  // ---- מצב קלט: PDF / הזנה ידנית ----
  const modePdf = $('modePdf'), modeManual = $('modeManual');
  const pdfPane = $('pdfPane'), manualPane = $('manualPane');
  const mRows = $('mRows'), mAdd = $('mAdd'), mBuild = $('mBuild');
  const mStatus = $('mStatus'), mClass = $('mClass'), mInst = $('mInst');

  function setMode(manual) {
    modeManual.classList.toggle('active', manual);
    modePdf.classList.toggle('active', !manual);
    manualPane.classList.toggle('hidden', !manual);
    pdfPane.classList.toggle('hidden', manual);
    resultSection.classList.add('hidden');
    parsed = null;
    if (manual && !mRows.children.length) { addManualRow(); addManualRow(); addManualRow(); }
  }
  modePdf.addEventListener('click', () => setMode(false));
  modeManual.addEventListener('click', () => setMode(true));

  function addManualRow(st) {
    const row = document.createElement('div');
    row.className = 'm-row';
    row.innerHTML =
      '<input type="text" class="m-name" placeholder="שם מלא" value="' + escapeHtml((st && st.fullName) || '') + '">' +
      '<input type="text" class="m-code mono" placeholder="קוד" value="' + escapeHtml((st && st.userCode) || '') + '">' +
      '<input type="text" class="m-pass mono" placeholder="סיסמה" value="' + escapeHtml((st && st.password) || '') + '">' +
      '<button type="button" class="m-del" title="מחיקה">✕</button>';
    row.querySelector('.m-del').addEventListener('click', () => row.remove());
    mRows.appendChild(row);
  }
  mAdd.addEventListener('click', () => addManualRow());
  mBuild.addEventListener('click', () => {
    const cls = mClass.value.trim();
    if (!cls) { mStatus.className = 'status err'; mStatus.textContent = 'צריך למלא שם כיתה.'; return; }
    const students = [];
    mRows.querySelectorAll('.m-row').forEach((r) => {
      const fullName = r.querySelector('.m-name').value.trim();
      const userCode = r.querySelector('.m-code').value.trim();
      const password = r.querySelector('.m-pass').value.trim();
      if (fullName || userCode || password) students.push({ fullName: fullName, userCode: userCode, password: password, birthDate: '' });
    });
    if (!students.length) { mStatus.className = 'status err'; mStatus.textContent = 'צריך להזין לפחות תלמיד/ה אחד/ת.'; return; }
    mStatus.className = 'status ok';
    mStatus.textContent = 'נוצרו ' + students.length + ' כרטיסים ✓';
    const inst = mInst.value.trim();
    const res = { institution: inst, classes: [{ name: cls, institution: inst, students: students }], totalStudents: students.length, valid: true };
    parsed = res;
    renderResult(res);
  });

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
    );
  }
})();
