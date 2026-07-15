/* מחולל כרטיסי סיסמה — כל העיבוד רץ בדפדפן בלבד. שום נתון לא יוצא החוצה. */
(function () {
  'use strict';

  // ---- pdfjs setup (vendored, offline) ----
  const pdfjsLib = window['pdfjsLib'];
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';

  const LOGIN_SITE = 'edu.gov.il';
  const DEBUG = false; // נחשף גם ב-window.__pcDebug אחרי פענוח

  // ---------------------------------------------------------------------------
  // פענוח עברית: הפונט של משרד החינוך ממפה אותיות עברית לטווח U+02A0–U+02BA
  // והמחרוזת שמורה הפוכה. רווח מיוצג ב-U+0003.
  // ---------------------------------------------------------------------------
  function fixHebrew(s) {
    let out = '';
    let hasHeb = false;
    for (const ch of s) {
      const cp = ch.charCodeAt(0);
      if (cp >= 0x02a0 && cp <= 0x02ba) {
        out += String.fromCharCode(cp - 0x02a0 + 0x05d0);
        hasHeb = true;
      } else if (cp === 0x03) {
        out += ' ';
      } else if (cp < 0x20) {
        // תווי בקרה (0x1d=":", 0x05='"', 0x11=".") — נשמטים
      } else {
        out += ch;
      }
    }
    if (hasHeb) out = Array.from(out).reverse().join('');
    return out.replace(/\s+/g, ' ').trim();
  }

  function clean(s) {
    return Array.from(String(s || ''))
      .filter((c) => c.charCodeAt(0) >= 0x20)
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function prettyClass(s) {
    s = clean(s);
    const m = s.match(/^([א-ת])\s+(\d+)$/); // "א 1" -> "א'1"
    return m ? m[1] + "'" + m[2] : s;
  }

  function hasHebrew(s) {
    return /[א-ת]/.test(s);
  }
  function isGarbledHebrew(s) {
    return /[ʠ-ʺ]/.test(s);
  }

  const RE_DATE = /\b(\d{2}\/\d{2}\/\d{4})\b/;
  const RE_USERCODE = /^\d{7}$/;

  // ---------------------------------------------------------------------------
  // חילוץ פריטי טקסט מכל עמוד, עם קואורדינטות, מקובצים לשורות לפי y.
  // ---------------------------------------------------------------------------
  async function extractPages(arrayBuffer) {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const items = content.items
        .filter((it) => it.str && it.str.trim() !== '')
        .map((it) => ({
          raw: it.str,
          text: isGarbledHebrew(it.str) ? fixHebrew(it.str) : it.str.trim(),
          x: it.transform[4],
          y: it.transform[5],
        }));
      pages.push(groupRows(items));
    }
    return pages;
  }

  // קיבוץ פריטים לשורות לפי קרבת y, ומיון בתוך שורה לפי x (יורד = מימין לשמאל).
  function groupRows(items, yTol = 4) {
    const sorted = items.slice().sort((a, b) => b.y - a.y);
    const rows = [];
    for (const it of sorted) {
      let row = rows.find((r) => Math.abs(r.y - it.y) <= yTol);
      if (!row) {
        row = { y: it.y, items: [] };
        rows.push(row);
      }
      row.items.push(it);
    }
    rows.forEach((r) => r.items.sort((a, b) => b.x - a.x)); // ימין -> שמאל
    return rows;
  }

  // ---------------------------------------------------------------------------
  // זיהוי מוסד + כיתה מתוך שורות הכותרת של עמוד.
  // ---------------------------------------------------------------------------
  function detectHeader(rows) {
    let institution = '';
    let className = '';
    let firstNameX = null;
    let lastNameX = null;

    const flat = [];
    rows.forEach((r) => r.items.forEach((it) => flat.push(it)));

    for (const t of flat) {
      const c = clean(t.text);
      const cc = c.replace(/\s/g, '');
      // "מוסד" — הערך נמצא משמאלו (x קטן יותר) באותה שורה
      if (c === 'מוסד') {
        const val = leftNeighbor(rows, t);
        if (val) institution = clean(val.text);
      }
      if (cc === 'שםפרטי') firstNameX = t.x;
      if (cc === 'שםמשפחה') lastNameX = t.x;
      // "כיתה" — הערך מוצמד לרוב לתווית ("כיתה א"), + ספרה שכנה משמאל ("1")
      if (cc.startsWith('כיתה')) {
        let cv = c.replace(/^כיתה/, '').trim();
        const row = rows.find((r) => r.items.indexOf(t) !== -1);
        if (row) {
          const lefts = row.items
            .filter((it) => it !== t && it.x < t.x)
            .sort((a, b) => b.x - a.x);
          for (const lt of lefts) {
            const lc = clean(lt.text);
            if (/^\d+$/.test(lc) || /^[א-ת]$/.test(lc)) cv = (cv + ' ' + lc).trim();
          }
        }
        if (cv) className = prettyClass(cv);
      }
    }
    return { institution, className, firstNameX, lastNameX };
  }

  // השכן משמאל (x קטן יותר) באותה שורה של פריט נתון.
  function leftNeighbor(rows, item) {
    const row = rows.find((r) => r.items.indexOf(item) !== -1);
    if (!row) return null;
    let best = null;
    for (const it of row.items) {
      if (it === item) continue;
      if (it.x < item.x && (!best || it.x > best.x)) best = it;
    }
    return best;
  }

  // ---------------------------------------------------------------------------
  // זיהוי שורת תלמיד ושיוך שדות בשיטת אלימינציה.
  // מבנה: סיסמה | קוד משתמש(7 ספרות) | תאריך לידה | שם פרטי | שם משפחה
  // ---------------------------------------------------------------------------
  function parseStudentRow(row, header) {
    // פירוק כל פריט לתת-מחרוזות (למקרה ש"קוד תאריך" מגיעים מחוברים),
    // תוך שמירת ה-x של הפריט לצורך שיוך עמודות שמות.
    const toks = [];
    for (const it of row.items) {
      if (hasHebrew(it.text)) {
        toks.push({ s: it.text, x: it.x, heb: true });
      } else {
        for (const part of it.text.split(/\s+/)) {
          if (part) toks.push({ s: part, x: it.x, heb: false });
        }
      }
    }

    let birthDate = null;
    let userCode = null;
    const numeric = []; // מועמדים לקוד/סיסמה
    const hebToks = [];

    for (const tk of toks) {
      if (tk.heb) {
        hebToks.push(tk);
        continue;
      }
      const dm = tk.s.match(RE_DATE);
      if (dm && !birthDate) {
        birthDate = dm[1];
        continue;
      }
      numeric.push(tk);
    }

    // חייבת להיות שורת תלמיד: תאריך + לפחות שני שדות לא-עבריים + שם אחד לפחות
    if (!birthDate || numeric.length < 1 || hebToks.length < 1) return null;

    // קוד משתמש = 7 ספרות. אם יש כמה — הימני ביותר הוא הסיסמה, הבא קוד.
    const sevenDigit = numeric.filter((t) => RE_USERCODE.test(t.s));
    let password = null;
    if (sevenDigit.length >= 2) {
      // התנגשות נדירה: סיסמה בת 7 ספרות. עמודת הסיסמה ימנית יותר (x גדול).
      sevenDigit.sort((a, b) => b.x - a.x);
      password = sevenDigit[0].s;
      userCode = sevenDigit[1].s;
    } else if (sevenDigit.length === 1) {
      userCode = sevenDigit[0].s;
      // הסיסמה = הפריט הלא-תאריך הנותר (ספרתי או אלפאנומרי), הימני ביותר
      const others = numeric.filter((t) => t !== sevenDigit[0]);
      if (others.length) {
        others.sort((a, b) => b.x - a.x);
        password = others[0].s;
      }
    } else {
      // אין קוד 7 ספרות — לא נראה כמו שורת תלמיד תקינה
      return null;
    }

    if (!password) return null;

    // שיוך שמות לפי קרבת x לכותרות שם פרטי / שם משפחה.
    let first = '';
    let last = '';
    if (hebToks.length === 1) {
      first = hebToks[0].s;
    } else {
      hebToks.sort((a, b) => b.x - a.x); // ימין -> שמאל
      if (header.firstNameX != null && header.lastNameX != null) {
        // בחר לכל שם את הפריט הקרוב ביותר בציר x
        const byFirst = nearest(hebToks, header.firstNameX);
        const byLast = nearest(hebToks, header.lastNameX);
        first = byFirst.s;
        last = byLast && byLast !== byFirst ? byLast.s : hebToks.filter((t) => t !== byFirst).map((t) => t.s).join(' ');
      } else {
        // ברירת מחדל: שם פרטי מימין (x גדול), שם משפחה משמאל
        first = hebToks[0].s;
        last = hebToks.slice(1).map((t) => t.s).join(' ');
      }
    }

    const fullName = (first + ' ' + last).replace(/\s+/g, ' ').trim();
    return { first, last, fullName, userCode, password, birthDate };
  }

  function nearest(toks, x) {
    let best = null;
    let bd = Infinity;
    for (const t of toks) {
      const d = Math.abs(t.x - x);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------------------
  // פענוח מלא: מחזיר מוסד + רשימת כיתות עם תלמידים.
  // ---------------------------------------------------------------------------
  async function parse(arrayBuffer) {
    const pages = await extractPages(arrayBuffer);

    // בדיקת שייכות: מילות מפתח של המערכת
    const allText = pages
      .map((rows) => rows.map((r) => r.items.map((i) => i.text).join(' ')).join(' '))
      .join(' ');
    const looksValid =
      /רשימת\s*סיסמאות/.test(allText) || (/מוסד/.test(allText) && /כיתה/.test(allText));

    const classMap = new Map(); // className -> {name, institution, students:[]}
    let institution = '';
    let lastClass = '';
    let lastHeader = { firstNameX: null, lastNameX: null };

    for (const rows of pages) {
      const header = detectHeader(rows);
      if (header.institution) institution = header.institution;
      if (header.className) lastClass = header.className;
      if (header.firstNameX != null) lastHeader.firstNameX = header.firstNameX;
      if (header.lastNameX != null) lastHeader.lastNameX = header.lastNameX;

      const clsName = lastClass || '—';
      for (const row of rows) {
        const st = parseStudentRow(row, lastHeader);
        if (st) {
          if (!classMap.has(clsName)) {
            classMap.set(clsName, { name: clsName, institution, students: [] });
          }
          classMap.get(clsName).students.push(st);
        }
      }
    }

    const classes = Array.from(classMap.values()).filter((c) => c.students.length > 0);
    classes.forEach((c) => (c.institution = institution));

    const totalStudents = classes.reduce((n, c) => n + c.students.length, 0);
    const result = { institution, classes, totalStudents, valid: looksValid && totalStudents > 0 };

    if (DEBUG || window.__pcDebugEnabled) {
      window.__pcDebug = { pages, result };
      console.log('[password-cards] parse result', result);
    }
    return result;
  }

  // חשיפה לשימוש ה-UI ולבדיקות
  window.PasswordCards = Object.assign(window.PasswordCards || {}, {
    parse,
    fixHebrew,
    LOGIN_SITE,
  });
})();
