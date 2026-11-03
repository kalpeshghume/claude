// Generates index.html (HyperFrames composition), dicts.srt and narration.txt
// from one data model, so captions, SRT and timeline never drift apart.
import { writeFileSync } from "node:fs";

const W = 1080, H = 1920, DUR = 36;
const CPS = 0.045; // seconds per typed character

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// token helpers: [class, text]
const v = (t) => ["v", t];  // variable
const o = (t) => ["o", t];  // operator / punctuation
const n = (t) => ["n", t];  // number
const s = (t) => ["s", t];  // string
const f = (t) => ["f", t];  // builtin function / method
const kw = (t) => ["k", t]; // keyword
const len = (line) => line.reduce((a, [, t]) => a + t.length, 0);

const personLine = [v("person"), o(" = {"), s('"name"'), o(": "), s('"Ada"'), o(", "), s('"age"'), o(": "), n("36"), o("}")];
const shortPerson = [v("person"), o(" = {"), s('"name"'), o(": "), s('"Ada"'), o("}")];
const personCells = [['"name"', '"Ada"', "s"], ['"age"', "36", "n"]];

const steps = [
  {
    id: "s1", start: 0, dur: 5.5, chip: "STEP 1", title: "Python Dicts in 30s", first: true,
    code: [
      personLine,
      [f("print"), o("("), v("person"), o(")")],
    ],
    out: ["{'name': 'Ada', 'age': 36}"], outAt: 4.2,
    diagram: "kv", cells: personCells, dgAt: 2.6,
  },
  {
    id: "s2", start: 5.5, dur: 6, chip: "STEP 2", title: "Access by key",
    code: [
      personLine,
      [f("print"), o("("), v("person"), o("["), s('"name"'), o("])")],
      [f("print"), o("("), v("person"), o("."), f("get"), o("("), s('"city"'), o("))")],
    ],
    out: ["Ada", "None"], outAt: 4.6, outStagger: 0.5,
    diagram: "kv", cells: personCells, hi: [[3.3, 0]],
  },
  {
    id: "s3", start: 11.5, dur: 6, chip: "STEP 3", title: "Mutable!",
    code: [
      shortPerson,
      [v("person"), o("["), s('"age"'), o("] = "), n("36")],
      [f("print"), o("("), v("person"), o(")")],
    ],
    out: ["{'name': 'Ada', 'age': 36}"], outAt: 4.0,
    diagram: "kv", cells: personCells, reveal: { 1: 2.0 },
  },
  {
    id: "s4", start: 17.5, dur: 6, chip: "STEP 4", title: "Loop over items",
    code: [
      personLine,
      [kw("for"), o(" "), v("k"), o(", "), v("v"), o(" "), kw("in"), o(" "), v("person"), o("."), f("items"), o("():")],
      [o("    "), f("print"), o("("), v("k"), o(", "), v("v"), o(")")],
    ],
    out: ["name Ada", "age 36"], outAt: 4.5, outStagger: 0.45,
    diagram: "kv", cells: personCells, hi: [[4.5, 0], [5.0, 1]],
  },
  {
    id: "s5", start: 23.5, dur: 6, chip: "STEP 5", title: "Missing keys",
    code: [
      shortPerson,
      [f("print"), o("("), v("person"), o("["), s('"city"'), o("])")],
    ],
    out: ["KeyError: 'city'"], outAt: 3.2, err: true,
    diagram: "cmp", dgAt: 3.6,
    left: ['person["city"]', "KeyError"],
    right: ['person.get("city")', "None"],
  },
  { id: "s6", start: 29.5, dur: 6.5, chip: "RECAP", title: "Remember", recap: true },
];

// Narration (also the on-screen captions and the SRT)
const caps = [
  [0.3, 2.0, "A dictionary stores"],
  [2.0, 4.6, "key-value pairs in curly braces."],
  [5.7, 7.8, "Look up a value by its key,"],
  [7.8, 9.3, "it's instant."],
  [9.3, 11.3, "Use .get() if the key may be missing."],
  [11.7, 13.6, "Dictionaries are mutable."],
  [13.6, 15.4, "Add or update a key"],
  [15.4, 17.4, "and the dict changes in place."],
  [17.7, 19.8, "Loop over .items()"],
  [19.8, 22.6, "to get each key and value together."],
  [23.7, 25.4, "Missing key?"],
  [25.4, 27.4, 'person["city"] raises KeyError,'],
  [27.4, 29.4, "so use .get() instead."],
  [29.7, 31.6, "Use dicts for labelled data,"],
  [31.6, 33.5, "like a profile or a config."],
  [33.5, 35.8, "Follow for more Python!"],
];

const tc = (sec) => {
  const ms = Math.round(sec * 1000);
  const p = (x, l = 2) => String(x).padStart(l, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor((ms % 3600000) / 60000))}:${p(Math.floor((ms % 60000) / 1000))},${p(ms % 1000, 3)}`;
};
writeFileSync("dicts.srt", caps.map(([a, b, t], i) => `${i + 1}\n${tc(a)} --> ${tc(b)}\n${t}\n`).join("\n"));
writeFileSync("narration.txt", caps.map(([, , t]) => t).join(" ") + "\n");

// ---------- markup ----------
const tl = []; // GSAP tween source lines
const T = (sel, vars, at) => tl.push(`tl.to(${JSON.stringify(sel)}, ${JSON.stringify(vars)}, ${at.toFixed(3)});`);
const FT = (sel, from, to, at) => tl.push(`tl.fromTo(${JSON.stringify(sel)}, ${JSON.stringify(from)}, ${JSON.stringify(to)}, ${at.toFixed(3)});`);

const kvRow = (id, cells) => `
      <div class="brace l">{</div><div class="brace r">}</div>
      <div class="row">
        ${cells.map(([k, val, cls], i) => `<div class="cell kv" id="${id}-c${i}">
          <span class="kk">${esc(k)}</span><span class="vv ${cls}">${esc(val)}</span></div>`).join("")}
      </div>`;

function stepHtml(st) {
  const { id, start, dur } = st;
  let body = "";
  const at = (t) => start + t;

  // heading
  body += `<div class="chip" id="${id}-chip">${st.chip}</div><div class="title" id="${id}-title">${esc(st.title)}</div>`;
  if (!st.first) FT(`#${id}-chip,#${id}-title`, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }, at(0.05));

  if (st.recap) {
    const rows = [
      ["Key \u2192 value", "each value has a label"],
      ["Mutable", "add, change or delete keys"],
      ["Great for", "records, configs, JSON"],
    ];
    body += rows.map(([k, d], i) => `<div class="rrow" id="${id}-r${i}"><span class="dot"></span><span><b>${k}</b><br><i>${d}</i></span></div>`).join("");
    rows.forEach((_, i) => FT(`#${id}-r${i}`, { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.4, ease: "power3.out" }, at(0.5 + i * 0.9)));
    body += `<div class="cta" id="${id}-cta">Save this for later</div>`;
    FT(`#${id}-cta`, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(1.6)" }, at(3.9));
  } else {
    // code
    let t = 0.4;
    body += `<div class="gutter-line"></div>`;
    st.code.forEach((line, i) => {
      const N = len(line);
      const d = Math.max(0.5, N * CPS);
      body += `<div class="ln" id="${id}-l${i}" style="top:${456 + i * 76}px"><span class="no">${i + 1}</span><span class="tx" id="${id}-t${i}">${line.map(([c, x]) => `<span class="${c}">${esc(x)}</span>`).join("")}</span></div>`;
      FT(`#${id}-t${i}`, { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: d, ease: `steps(${N})` }, at(t));
      t += d + 0.2;
    });

    // diagram
    if (st.diagram === "kv") {
      body += `<div class="dg" id="${id}-dg">${kvRow(id, st.cells)}</div>`;
      FT(`#${id}-dg`, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, at(st.dgAt ?? 0.8));
      Object.entries(st.reveal || {}).forEach(([i, tt]) => {
        FT(`#${id}-c${i}`, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(1.8)" }, at(tt));
      });
      (st.hi || []).forEach(([tt, ci]) => {
        T(`#${id}-c${ci}`, { borderColor: "#4ec9b0", backgroundColor: "#1f3a36", duration: 0.25, ease: "power2.out" }, at(tt));
      });
    } else if (st.diagram === "cmp") {
      body += `<div class="dg" id="${id}-dg">
        <div class="cmp bad" id="${id}-p0"><div class="big">${esc(st.left[0])}</div><div class="lab">${esc(st.left[1])}</div></div>
        <div class="cmp good" id="${id}-p1"><div class="big">${esc(st.right[0])}</div><div class="lab">${esc(st.right[1])}</div></div>
      </div>`;
      FT(`#${id}-p0,#${id}-p1`, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.3, ease: "power3.out" }, at(st.dgAt ?? 3.4));
    }

    // terminal output
    body += `<div class="tline prompt" id="${id}-o0">$ python dicts.py</div>`;
    FT(`#${id}-o0`, { opacity: 0 }, { opacity: 1, duration: 0.2 }, at(st.outAt - 0.2));
    st.out.forEach((line, i) => {
      const cls = st.err ? "tline err" : "tline";
      const top = 1102 + i * 44;
      body += `<div class="${cls}" id="${id}-o${i + 1}" style="top:${top}px">${esc(line)}</div>`;
      FT(`#${id}-o${i + 1}`, { opacity: 0 }, { opacity: 1, duration: 0.2 }, at(st.outAt + i * (st.outStagger || 0)));
    });
  }

  // fade whole step in/out (first step starts fully visible for the thumbnail)
  if (!st.first) FT(`#${id}-wrap`, { opacity: 0 }, { opacity: 1, duration: 0.15 }, at(0));
  T(`#${id}-wrap`, { opacity: 0, duration: 0.12 }, at(dur - 0.14));

  return `
  <div id="${id}" class="clip step" data-start="${start}" data-duration="${dur}" data-track-index="1">
    <div class="wrap" id="${id}-wrap">${body}</div>
  </div>`;
}

const capHtml = caps.map(([a, b, t], i) => {
  const d = +(b - a).toFixed(3);
  FT(`#cap${i} .ct`, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.18, ease: "power2.out" }, a);
  T(`#cap${i} .ct`, { opacity: 0, duration: 0.1 }, b - 0.12);
  return `<div id="cap${i}" class="clip cap" data-start="${a}" data-duration="${d}"><div class="ct">${esc(t)}</div></div>`;
}).join("\n    ");

const texture = [
  'person = {"name": "Ada"}',
  'person["age"] = 36',
  'print(person.keys())',
  'print(person.values())',
  'for k, v in person.items():',
  'person.get("city", "n/a")',
  '"age" in person',
  'del person["age"]',
  'd = dict(name="Ada")',
  'len(person)',
  'person.update({"x": 1})',
  'scores = {"math": 92}',
  'scores.setdefault("eng", 0)',
].map((l, i) => `<div class="tex" style="top:${24 + i * 36}px"><span>${String(i + 1).padStart(2, " ")}</span> ${esc(l)}</div>`).join("");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${W}, height=${H}">
<title>Python Dictionaries in 30s</title>
<style>
  @font-face { font-family: "JetBrains Mono"; font-weight: 400; src: url("assets/fonts/JetBrainsMono-400.woff2") format("woff2"); }
  @font-face { font-family: "JetBrains Mono"; font-weight: 700; src: url("assets/fonts/JetBrainsMono-700.woff2") format("woff2"); }
  @font-face { font-family: "Inter"; font-weight: 400; src: url("assets/fonts/Inter-400.woff2") format("woff2"); }
  @font-face { font-family: "Inter"; font-weight: 700; src: url("assets/fonts/Inter-700.woff2") format("woff2"); }
  :root { --bg:#1e1e1e; --panel:#252526; --term:#181818; --line:#2d2d2d; --fg:#d4d4d4; --blue:#007acc; --teal:#4ec9b0; --orange:#ce9178; --yellow:#ffd43b; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${W}px; height: ${H}px; background: var(--bg); overflow: hidden; }
  body { font-family: "Inter", sans-serif; color: var(--fg); }
  #root { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; background: var(--bg); overflow: hidden; }
  .mono, .ln, .tline, .cell, .big, .brace, .badge { font-family: "JetBrains Mono", monospace; }

  /* IDE chrome */
  #tabbar { position: absolute; left: 0; top: 168px; width: ${W}px; height: 84px; background: var(--panel); border-bottom: 1px solid var(--line); }
  #tab { position: absolute; left: 108px; top: 0; width: 380px; height: 84px; background: var(--bg); border-top: 4px solid var(--blue); display: flex; align-items: center; gap: 16px; padding-left: 24px; font-size: 32px; color: #fff; }
  #tab .py { width: 22px; height: 22px; border-radius: 6px; background: linear-gradient(135deg,#3776ab 50%,#ffd43b 50%); }
  #term { position: absolute; left: 0; top: 1006px; width: ${W}px; height: 200px; background: var(--term); border-top: 2px solid #2b2b2b; }
  #term .hd { position: absolute; left: 108px; top: 8px; font-size: 28px; letter-spacing: 3px; color: #bbb; border-bottom: 3px solid var(--blue); padding-bottom: 2px; }
  #status { position: absolute; left: 0; top: 1836px; width: ${W}px; height: 84px; background: var(--blue); }
  #status span { position: absolute; top: 24px; font-size: 28px; color: #fff; }
  #texwrap { position: absolute; left: 0; top: 1330px; width: ${W}px; height: 506px; background: var(--bg); overflow: hidden; }
  .tex { position: absolute; left: 108px; font-family: "JetBrains Mono", monospace; font-size: 28px; color: #fff; opacity: .2; white-space: pre; }
  .tex span { color: #fff; margin-right: 24px; }
  #texwrap::after { content: ""; position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(30,30,30,.0), rgba(30,30,30,.75)); }

  .step { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; }
  .wrap { position: absolute; inset: 0; }
  .chip { position: absolute; left: 108px; top: 284px; padding: 6px 18px; border-radius: 999px; background: rgba(0,122,204,.22); color: #4fc1ff; font-weight: 700; font-size: 28px; letter-spacing: 2px; }
  .title { position: absolute; left: 108px; top: 332px; font-weight: 700; font-size: 68px; color: #fff; white-space: nowrap; line-height: 90px; }
  .gutter-line { position: absolute; left: 160px; top: 440px; width: 2px; height: 236px; background: #2f2f2f; }
  .ln { position: absolute; left: 108px; height: 76px; line-height: 76px; font-size: 38px; white-space: pre; }
  .ln .no { display: inline-block; width: 52px; color: #858585; text-align: left; }
  .ln .tx { display: inline-block; margin-left: 12px; white-space: pre; }
  .v{color:#9cdcfe} .o{color:#d4d4d4} .n{color:#b5cea8} .s{color:#ce9178} .f{color:#dcdcaa} .k{color:#569cd6} .c{color:#6a9955}

  .dg { position: absolute; left: 0; top: 700px; width: ${W}px; height: 290px; }
  .row { position: absolute; left: 0; top: 70px; width: ${W}px; display: flex; justify-content: center; gap: 24px; }
  .cell { position: relative; width: 220px; height: 130px; border: 3px solid #454545; border-radius: 16px; background: #252526; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
  .cell .kk { font-size: 30px; color: var(--teal); }
  .cell .vv { font-size: 40px; }
  .brace { position: absolute; top: 40px; font-size: 150px; line-height: 150px; color: #5a5a5a; font-weight: 400; }
  .brace.l { left: 112px; } .brace.r { right: 112px; }
  .cmp { position: absolute; top: 40px; width: 420px; height: 210px; border-radius: 18px; border: 3px solid; text-align: center; }
  .cmp.bad { left: 108px; border-color: #f48771; background: rgba(244,135,113,.08); }
  .cmp.good { right: 108px; border-color: var(--teal); background: rgba(78,201,176,.10); }
  .cmp .big { font-size: 34px; color: #fff; margin-top: 52px; }
  .cmp .lab { font-size: 38px; margin-top: 16px; font-weight: 700; }
  .bad .lab { color: #f48771; } .good .lab { color: var(--teal); }

  .tline { position: absolute; left: 108px; top: 1058px; font-size: 32px; color: #cccccc; white-space: pre; }
  .tline.prompt { color: #6a9955; }
  .tline.err { color: #f48771; }

  .rrow { position: absolute; left: 108px; width: 864px; display: flex; align-items: center; gap: 28px; font-size: 44px; line-height: 56px; }
  #s6-r0 { top: 440px; } #s6-r1 { top: 575px; } #s6-r2 { top: 710px; }
  .rrow b { color: #fff; font-size: 52px; } .rrow i { font-style: normal; color: #9aa0a6; font-size: 34px; }
  .dot { width: 26px; height: 26px; border-radius: 50%; background: var(--teal); flex: none; }
  .cta { position: absolute; left: 108px; top: 868px; width: 864px; text-align: center; padding: 22px 0; border-radius: 20px; background: var(--yellow); color: #1e1e1e; font-weight: 700; font-size: 48px; }

  #caps { position: absolute; left: 0; top: 1214px; width: ${W}px; height: 116px; }
  .cap { position: absolute; left: 108px; top: 0; width: 864px; height: 116px; display: flex; align-items: center; justify-content: center; text-align: center; }
  .cap .ct { font-weight: 700; font-size: 48px; line-height: 58px; color: #fff; text-shadow: 0 2px 8px rgba(0,0,0,.9); }
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${DUR}" data-width="${W}" data-height="${H}">

  <div id="chrome" data-layout-ignore>
    <div id="tabbar"><div id="tab"><span class="py"></span>dicts.py</div></div>
    <div id="term"><div class="hd">TERMINAL</div></div>
    <div id="texwrap">${texture}</div>
    <div id="status"><span style="left:108px">Python 3.12</span><span style="right:108px">UTF-8</span></div>
  </div>
${steps.map(stepHtml).join("\n")}

  <div id="caps" data-track-kind="captions">
    ${capHtml}
  </div>
</div>
<script src="assets/gsap.min.js"></script>
<script>
  window.__timelines = window.__timelines || {};
  const tl = gsap.timeline({ paused: true });
  ${tl.join("\n  ")}
  window.__timelines["main"] = tl;
</script>
</body>
</html>
`;
writeFileSync("index.html", html);
console.log("wrote index.html, dicts.srt, narration.txt;", tl.length, "tweens");
