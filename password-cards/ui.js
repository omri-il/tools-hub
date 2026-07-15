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

  function setStatus(msg, kind) {
    statusEl.className = 'status' + (kind ? ' ' + kind : '');
    statusEl.textContent = msg;
  }

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
          '<div class="cls-row"><label><input type="checkbox" class="cls-cb" data-i="' +
          i +
          '" checked><span class="cls-name">כיתה ' +
          escapeHtml(c.name) +
          '</span><span class="cls-count">' +
          c.students.length +
          ' תלמידים</span></label></div>'
      )
      .join('');

    if (res.classes.length === 1) $('clsCard').classList.add('hidden');
    else $('clsCard').classList.remove('hidden');

    renderPreview(res);
    resultSection.classList.remove('hidden');
    clsList.querySelectorAll('.cls-cb').forEach((cb) => cb.addEventListener('change', () => renderPreview(res)));
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function selectedClasses() {
    if (!parsed) return [];
    const checked = new Set(
      Array.from(clsList.querySelectorAll('.cls-cb'))
        .filter((cb) => cb.checked)
        .map((cb) => +cb.dataset.i)
    );
    return parsed.classes.filter((_, i) => checked.has(i));
  }

  function renderPreview(res) {
    const classes = selectedClasses();
    const rows = [];
    classes.forEach((c) => {
      c.students.forEach((s) => {
        rows.push(
          '<tr><td>' +
            escapeHtml(c.name) +
            '</td><td>' +
            escapeHtml(s.fullName) +
            '</td><td class="mono">' +
            escapeHtml(s.userCode) +
            '</td><td class="mono">' +
            escapeHtml(s.password) +
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

  // ---- ייצוא ----
  exportBtn.addEventListener('click', async () => {
    const classes = selectedClasses();
    if (!classes.length) return;
    exportBtn.disabled = true;
    progressEl.classList.remove('hidden');
    progressEl.textContent = 'מכין את הקובץ…';
    try {
      await window.PasswordCards.generate(classes, (done, total) => {
        progressEl.textContent = 'מעבד עמוד ' + done + ' מתוך ' + total + '…';
      });
      progressEl.textContent = 'הקובץ הורד בהצלחה ✓';
    } catch (err) {
      console.error(err);
      progressEl.textContent = 'אירעה שגיאה בהפקת ה-PDF. נסה שוב.';
    } finally {
      exportBtn.disabled = false;
    }
  });

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
    );
  }
})();
