// Anel "derretido" dos selos (MoltenSeals.astro). Adaptação sem React do MoltenRingCarousel:
//
// O círculo é bem maior que o palco e o centro fica à esquerda dele, então só uma fatia cruza a tela: um arco
// alto de cards passando, com um de frente. Não há malha nem <img>: cada card é um campo de distância de
// retângulo arredondado e o quadro inteiro é um passe só, com um "mínimo suave" entre todos. É esse operador
// que faz a física: dois cards que se aproximam não se sobrepõem, se fundem; dois que se afastam deixam um fio,
// que é só mais um termo no mesmo campo e afina, pende e arrebenta sozinho conforme a distância cresce.
// O cursor nunca é desenhado: ele amolece o campo embaixo de si, inclina os cards próximos, afasta os vizinhos
// e puxa fios entre eles.
//
// Diferenças em relação ao original, para caber numa LP:
// - a roda do mouse NÃO gira o anel (prenderia a rolagem da página); giram o arrasto, as setas, o teclado e o
//   clique num card. No celular, arrastar para os lados (para cima e para baixo continua rolando a página);
// - a chegada (baralho fundido que se abre em fios) só começa quando o anel entra na tela;
// - fora da tela ou com a aba escondida, o laço de desenho para;
// - cada célula do atlas é um card branco com o selo e o nome, desenhados num canvas 2D.

interface Seal {
  src: string;
  label: string;
  group: string;
  text: string;
}

const MAX_CARDS = 24;
const MAX_STRANDS = 24;

// Tudo em múltiplos da aresta longa do card, para as proporções valerem em qualquer tela
const FUSE = 0.087;
const CORNER = 0.035;
const CROSSFADE = 0.035;
const SPACING = 1.55;

const CURSOR_FUSE = 0.085;
const CURSOR_REACH = 0.65;
const PULL = 0.065;
const SWELL = 0.09;
const REACH = 1.7;
const GRAB = 0.14;
const RELEASE = 0.06;
const NEIGHBOUR_PUSH = 0.042;
const NEIGHBOUR_SCALE = 0.035;
const NEIGHBOUR_DIM = 0.15;
const NEIGHBOUR_REACH = 2.4;
const WAVE = 0.01;
const WAVE_FREQ = 20;
const WAVE_SPEED = 7;

const STRAND = 0.2;
const STRAND_SNAP = 1.15;
const WAIST = 0.35;
const SAG = 0.015;
const WELD = 0.035;

const BAND = 0.08;
const REFRACT = 0.15;
const SQUEEZE = 0.05;
const RIPPLE = 0.0125;
const RIPPLE_FREQ = 8;
const FRINGE = 0.004;
const SHEEN = 0.05;

const WOBBLE = 0.0075;

const DRAG = 0.007;
const EASE = 0.08;
const SNAP_IDLE = 260;
const SNAP_EASE = 0.06;
const CLICK_SLOP = 6;
const CLICK_MS = 700;

const ENTRY_MS = 2600;
const CARD_RATIO = 1.5;
const ARC = 1;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const inOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const outCubic = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const pad2 = (n: number) => String(n).padStart(2, '0');

const QUAD_VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos;
  gl_Position = vec4(aPos * 2.0 - 1.0, 0.0, 1.0);
}`;

const RING_FRAG = `#version 300 es
precision highp float;

#define MAX_CARDS ${MAX_CARDS}
#define MAX_STRANDS ${MAX_STRANDS}

in vec2 vUv;
out vec4 fragColor;

uniform vec2  uResolution;
uniform vec2  uSize;
uniform float uCorner;

uniform float uCount;
uniform vec2  uCentre[MAX_CARDS];
uniform float uAngle[MAX_CARDS];
uniform vec4  uCardState[MAX_CARDS]; // xy escala, z brilho, w célula do atlas

uniform float uStrandCount;
uniform vec2  uStrandA[MAX_STRANDS];
uniform vec2  uStrandB[MAX_STRANDS];
uniform vec4  uStrandPar[MAX_STRANDS];

uniform float uFuse;
uniform float uJitter;
uniform float uTime;
uniform vec3  uColor;

uniform sampler2D uAtlas;
uniform vec2  uGrid;
uniform float uCrossfade;
uniform float uHasArt;

uniform vec4  uCursor;
uniform vec4  uWake;

uniform float uLipDepth;
uniform vec4  uLip;
uniform float uFringe;
uniform float uSheen;

vec2 atlasUV(vec2 uv, float idx) {
  return (vec2(mod(idx, uGrid.x), floor(idx / uGrid.x)) + uv) / uGrid;
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  ) * 2.0 - 1.0;
}

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

// Fio entre dois cards: uma lâmina de centro a centro, grossa nas pontas, fina no meio e pendendo
float sdStrand(vec2 p, vec2 a, vec2 b, float rEnd, float rMid, float sag) {
  vec2 ba = b - a;
  float len = length(ba);
  if (len < 0.001) return 1e6;
  vec2 dir = ba / len;
  vec2 nrm = vec2(-dir.y, dir.x);
  vec2 q = p - (a + b) * 0.5;
  float along = dot(q, dir);
  float across = dot(q, nrm);
  float h = clamp(along / len + 0.5, 0.0, 1.0);
  float bell = sin(3.14159265 * h);
  across += sag * bell * nrm.y;
  float r = mix(rMid, rEnd, pow(1.0 - bell, 1.7));
  return max(abs(along) - len * 0.5, abs(across) - r);
}

float smin(float a, float b, float k) {
  if (k <= 0.0001) return min(a, b);
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// Faixas de cima e de baixo como a borda lapidada de um vidro grosso
float lipWarp(inout vec2 p) {
  if (uLipDepth <= 0.5) return 0.0;
  float dy = abs(p.y) - (uResolution.y * 0.5 - uLipDepth);
  if (dy <= 0.0) return 0.0;
  float t = clamp(dy / uLipDepth, 0.0, 1.0);
  float bend = 1.0 - sqrt(max(0.0, 1.0 - t * t));
  p.y -= sign(p.y) * bend * (uLip.x + sin(p.x * uLip.w) * uLip.z);
  p.x *= 1.0 - bend * uLip.y;
  return bend;
}

void main() {
  vec2 p = (vUv - 0.5) * uResolution;
  float bend = lipWarp(p);
  float toCursor = length(p - uCursor.xy);

  float k = uFuse;
  if (uCursor.z > 0.001) {
    float t = 1.0 - smoothstep(0.0, max(uWake.x, 1.0), toCursor);
    k += uCursor.w * uCursor.z * t * t;
  }

  float d = 1e6;
  float d0 = 1e6, d1 = 1e6;
  vec2 uv0 = vec2(0.5), uv1 = vec2(0.5);
  float im0 = 0.0, im1 = 0.0;
  float dm0 = 1.0, dm1 = 1.0;
  float halfSpan = length(uSize) * 0.5;

  for (int i = 0; i < MAX_CARDS; i++) {
    if (float(i) >= uCount) break;
    vec4 st = uCardState[i];
    float grown = max(st.x, st.y);
    if (grown <= 0.0001) continue;
    vec2 q = p - uCentre[i];
    float cull = halfSpan * grown + k + uJitter + 8.0;
    if (dot(q, q) > cull * cull) continue;
    float ca = cos(uAngle[i]), sa = sin(uAngle[i]);
    q = vec2(q.x * ca + q.y * sa, -q.x * sa + q.y * ca);
    vec2 halfSize = max(uSize * 0.5 * st.xy, vec2(0.0001));
    float rMax = min(halfSize.x, halfSize.y);
    float r = min(rMax, mix(rMax, uCorner, smoothstep(0.30, 1.0, min(st.x, st.y))));
    float di = sdRoundBox(q, halfSize, r);
    d = smin(d, di, k);
    vec2 luv = clamp(q / (2.0 * halfSize) + 0.5, 0.004, 0.996);
    luv.y = 1.0 - luv.y;
    if (di < d0) {
      d1 = d0; uv1 = uv0; im1 = im0; dm1 = dm0;
      d0 = di; uv0 = luv; im0 = st.w; dm0 = st.z;
    } else if (di < d1) {
      d1 = di; uv1 = luv; im1 = st.w; dm1 = st.z;
    }
  }

  for (int i = 0; i < MAX_STRANDS; i++) {
    if (float(i) >= uStrandCount) break;
    vec4 par = uStrandPar[i];
    if (par.x <= -3.0) continue;
    vec2 a = uStrandA[i], b = uStrandB[i];
    vec2 mid = (a + b) * 0.5;
    float span = length(b - a) * 0.5 + par.x + par.w + 8.0;
    if (dot(p - mid, p - mid) > span * span) continue;
    d = smin(d, sdStrand(p, a, b, par.x, par.y, par.z), par.w);
  }

  if (uJitter > 0.001) {
    d += noise(p * 0.012 + vec2(uTime * 0.22, uTime * -0.17)) * uJitter;
  }
  if (uWake.y > 0.001) {
    d += sin(toCursor * uWake.z - uTime * uWake.w) * uWake.y * exp(-toCursor / max(uWake.x, 1.0));
  }

  float aa = clamp(fwidth(d), 0.5, 2.0);
  float alpha = 1.0 - smoothstep(-aa, aa, d);
  if (alpha <= 0.001) discard;

  float nearest = smoothstep(-uCrossfade, uCrossfade, d1 - d0);
  vec3 col = uColor;
  if (uHasArt > 0.5) {
    vec2 fr = vec2(uFringe * bend, 0.0);
    vec3 c0 = vec3(
      texture(uAtlas, atlasUV(uv0 + fr, im0)).r,
      texture(uAtlas, atlasUV(uv0, im0)).g,
      texture(uAtlas, atlasUV(uv0 - fr, im0)).b
    );
    vec3 c1 = vec3(
      texture(uAtlas, atlasUV(uv1 + fr, im1)).r,
      texture(uAtlas, atlasUV(uv1, im1)).g,
      texture(uAtlas, atlasUV(uv1 - fr, im1)).b
    );
    col = mix(c1, c0, nearest);
  }
  col *= mix(dm1, dm0, nearest);
  col += bend * uSheen;
  fragColor = vec4(col, alpha);
}`;

function build(gl: WebGL2RenderingContext): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;
  for (const [type, source] of [
    [gl.VERTEX_SHADER, QUAD_VERT],
    [gl.FRAGMENT_SHADER, RING_FRAG],
  ] as const) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn(gl.getShaderInfoLog(shader));
      return null;
    }
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.bindAttribLocation(program, 0, 'aPos');
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  return program;
}

/** Quebra o nome do selo em até duas linhas que caibam na largura. */
function lines(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > max && line) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out.slice(0, 2);
}

/** Uma folha só, com um card por célula: fundo branco, selo centralizado e o nome embaixo. */
function packAtlas(images: HTMLImageElement[], seals: Seal[], cols: number, cell: number): HTMLCanvasElement {
  const cellH = Math.round(cell / CARD_RATIO);
  const rows = Math.ceil(images.length / cols);
  const sheet = document.createElement('canvas');
  sheet.width = cols * cell;
  sheet.height = rows * cellH;
  const ctx = sheet.getContext('2d');
  if (!ctx) return sheet;
  const body = getComputedStyle(document.body).fontFamily || 'sans-serif';
  images.forEach((image, i) => {
    const x = (i % cols) * cell;
    const y = Math.floor(i / cols) * cellH;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, cell, cellH);
    if (image.naturalWidth && image.naturalHeight) {
      const box = cellH * 0.5;
      const s = Math.min(box / image.naturalWidth, box / image.naturalHeight);
      const w = image.naturalWidth * s;
      const h = image.naturalHeight * s;
      ctx.drawImage(image, x + (cell - w) / 2, y + cellH * 0.38 - h / 2, w, h);
    }
    ctx.fillStyle = '#231f20';
    ctx.font = `500 ${Math.round(cell * 0.048)}px ${body}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const ls = lines(ctx, seals[i]!.label, cell * 0.84);
    const lh = cell * 0.062;
    const top = y + cellH * 0.79 - ((ls.length - 1) * lh) / 2;
    ls.forEach((l, k) => ctx.fillText(l, x + cell / 2, top + k * lh));
  });
  return sheet;
}

export function initMoltenRing(): void {
  const root = document.querySelector<HTMLElement>('[data-molten]');
  if (!root) return;
  const canvas = root.querySelector<HTMLCanvasElement>('[data-mr-canvas]')!;
  const seals = JSON.parse(root.dataset.seals ?? '[]') as Seal[];
  const count = Math.min(seals.length, MAX_CARDS);
  if (count < 2) return;

  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false });
  if (!gl) return; // fica a grade comum
  const program = build(gl);
  if (!program) return;
  root.classList.add('is-gl');

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cache = new Map<string, WebGLUniformLocation | null>();
  const u = (name: string) => {
    let loc = cache.get(name);
    if (loc === undefined) {
      loc = gl.getUniformLocation(program, name);
      cache.set(name, loc);
    }
    return loc;
  };

  const quad = gl.createVertexArray();
  gl.bindVertexArray(quad);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // --- legendas -------------------------------------------------------------
  const $ = (sel: string) => root.querySelector<HTMLElement>(sel)!;
  const capIdx = $('[data-mr-idx]');
  const capNum = $('[data-mr-num]');
  const live = $('[data-mr-live]');
  let capTitle = $('[data-mr-title]');
  let capGroup = $('[data-mr-group]');
  let capText = $('[data-mr-text]');
  let active = 0;
  let announce = false;
  const fresh = (el: HTMLElement, text: string) => {
    const n = el.cloneNode() as HTMLElement; // elemento novo = a entrada da legenda roda de novo
    n.textContent = text;
    el.replaceWith(n);
    return n;
  };
  const showCaption = (i: number) => {
    const s = seals[i]!;
    capIdx.textContent = pad2(i + 1);
    capNum.textContent = pad2(i + 1);
    capTitle = fresh(capTitle, s.label);
    capGroup = fresh(capGroup, s.group);
    capText = fresh(capText, s.text);
    if (announce) live.textContent = `${s.label}. ${s.group}. ${s.text}`;
  };

  // --- artes ----------------------------------------------------------------
  const COLS = Math.min(4, count);
  const CELL = 512;
  let atlas: WebGLTexture | null = null;
  let loaded = 0;
  const images = seals.slice(0, count).map((s) => {
    const image = new Image();
    image.decoding = 'async';
    const settle = () => {
      if (++loaded < count) return;
      void (document.fonts?.ready ?? Promise.resolve()).then(() => {
        atlas = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, atlas);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, packAtlas(imgs, seals, COLS, CELL));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      });
    };
    image.onload = settle;
    image.onerror = settle;
    return { image, src: s.src };
  });
  // As fotos dos selos só são baixadas quando o anel se aproxima da tela
  let requested = false;
  const request = () => {
    if (requested) return;
    requested = true;
    images.forEach(({ image, src }) => (image.src = src));
  };
  const imgs = images.map((x) => x.image);

  // --- estado ---------------------------------------------------------------
  const FRONT = Math.floor(count / 2);
  let width = 0;
  let height = 0;
  let progress = -FRONT; // começa com o primeiro selo de frente
  let goal = -FRONT;
  let lastInput = 0;
  let snapped = true;
  let hovered = -1;
  let pointerX = -1;
  let pointerY = -1;
  let pointerSpeed = 0;
  let entry = 0;
  let entering = false; // a chegada só corre com o anel na tela
  let clock = 0;
  let previous = 0;
  let frame = 0;
  let running = false;
  let tween: { from: number; to: number; at: number } | null = null;

  const leanX = new Float32Array(count);
  const leanY = new Float32Array(count);
  const swell = new Float32Array(count);
  const dim = new Float32Array(count);
  const pos = new Float32Array(MAX_CARDS * 2);
  const rot = new Float32Array(MAX_CARDS);
  const state = new Float32Array(MAX_CARDS * 4);
  const strandA = new Float32Array(MAX_STRANDS * 2);
  const strandB = new Float32Array(MAX_STRANDS * 2);
  const strandPar = new Float32Array(MAX_STRANDS * 4);
  const at = Array.from({ length: count }, () => ({ x: 0, y: 0, angle: 0, scale: 1 }));

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    const cap = matchMedia('(pointer: coarse)').matches ? 1.5 : 2;
    const dpr = Math.min(window.devicePixelRatio || 1, cap);
    width = w;
    height = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  };
  resize();
  new ResizeObserver(resize).observe(canvas);

  // --- entrada --------------------------------------------------------------
  const step = (by: number) => {
    announce = true;
    tween = { from: goal, to: Math.round(goal) + by, at: performance.now() };
    lastInput = performance.now();
    snapped = true;
    wake();
  };
  root.querySelectorAll<HTMLButtonElement>('[data-mr-step]').forEach((b) =>
    b.addEventListener('click', () => step(Number(b.dataset.mrStep))),
  );
  canvas.addEventListener('keydown', (e) => {
    const by = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!by) return;
    e.preventDefault();
    step(by);
  });

  let drag: { x: number; y: number; touch: boolean } | null = null;
  let dragTravel = 0;
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse' };
    dragTravel = 0;
    tween = null;
    if (!drag.touch) canvas.setPointerCapture(e.pointerId);
    wake();
  });
  canvas.addEventListener('pointermove', (e) => {
    const box = canvas.getBoundingClientRect();
    const nx = e.clientX - box.left;
    const ny = e.clientY - box.top;
    if (e.pointerType === 'mouse') {
      pointerSpeed = Math.hypot(nx - pointerX, ny - pointerY);
      pointerX = nx;
      pointerY = ny;
    }
    if (drag) {
      // mouse: para cima e para baixo, como no original; toque: para os lados
      const travel = drag.touch ? drag.x - e.clientX : drag.y - e.clientY;
      dragTravel += Math.abs(travel);
      drag.x = e.clientX;
      drag.y = e.clientY;
      goal += travel * DRAG * (drag.touch ? 1.4 : 1);
      lastInput = performance.now();
      snapped = false;
      announce = true;
    }
    wake();
  });
  const up = (e: PointerEvent) => {
    const wasClick = drag !== null && dragTravel < CLICK_SLOP;
    drag = null;
    if (!wasClick) return;
    // toque não tem "hover": acha o card embaixo do dedo
    if (e.pointerType !== 'mouse') {
      const box = canvas.getBoundingClientRect();
      hovered = hit(e.clientX - box.left - width / 2, height / 2 - (e.clientY - box.top));
    }
    if (hovered < 0) return;
    const want = (((hovered - FRONT) % count) + count) % count;
    announce = true;
    tween = { from: goal, to: want + Math.round((goal - want) / count) * count, at: performance.now() };
    snapped = true;
    wake();
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', () => (drag = null));
  canvas.addEventListener('pointerleave', () => {
    pointerX = -1;
    pointerY = -1;
    hovered = -1;
  });

  let long = 0;
  let short = 0;
  const hit = (mx: number, my: number) => {
    let found = -1;
    let best = Infinity;
    for (let i = 0; i < count; i++) {
      const dx = Math.abs(mx - at[i]!.x);
      const dy = Math.abs(my - at[i]!.y);
      if (dx > long / 2 || dy > short / 2) continue;
      if (dx + dy < best) {
        best = dx + dy;
        found = i;
      }
    }
    return found;
  };

  // --- quadro ---------------------------------------------------------------
  const draw = (now: number) => {
    frame = running ? requestAnimationFrame(draw) : 0;
    if (!width || !height) return;
    const dt = previous ? Math.min((now - previous) / 1000, 1 / 20) : 0;
    previous = now;
    clock += dt;

    if (atlas && entering) entry = reduced ? 1 : Math.min(1, entry + (dt * 1000) / ENTRY_MS);
    const spread = inOutCubic(entry);

    if (tween) {
      const t = clamp((now - tween.at) / CLICK_MS, 0, 1);
      goal = tween.from + (tween.to - tween.from) * outCubic(t);
      if (t >= 1) tween = null;
    } else if (!snapped && now - lastInput > SNAP_IDLE) {
      goal = Math.round(goal);
      snapped = true;
    }
    progress += (goal - progress) * (reduced ? 1 : snapped ? SNAP_EASE : EASE);
    const speed = Math.abs(goal - progress);

    const near = (((Math.round(goal) + FRONT) % count) + count) % count;
    if (near !== active) {
      active = near;
      showCaption(near);
    }

    // Geometria: card maior no celular, onde o palco é estreito
    const mobile = width < 700;
    long = width * (mobile ? 0.66 : 0.24);
    short = long / CARD_RATIO;
    const radius = width * ARC * (mobile ? 1.6 : 1);
    const angleStep = (short * SPACING) / radius;
    const centreX = -radius;
    for (let i = 0; i < count; i++) {
      const slot = ((((i - progress) % count) + count) % count) - FRONT;
      const angle = slot * angleStep * spread;
      at[i]!.angle = angle;
      at[i]!.x = centreX + Math.cos(angle) * radius;
      at[i]!.y = Math.sin(angle) * radius;
    }

    const mx = pointerX >= 0 ? pointerX - width / 2 : 0;
    const my = pointerY >= 0 ? height / 2 - pointerY : 0;
    const present = pointerX >= 0 ? 1 : 0;
    if (present && pointerSpeed < 24) hovered = hit(mx, my);
    pointerSpeed *= 0.85;

    let strands = 0;
    for (let i = 0; i < count; i++) {
      const c = at[i]!;
      const dx = mx - c.x;
      const dy = my - c.y;
      const pull = present ? Math.max(0, 1 - Math.hypot(dx, dy) / (long * REACH)) : 0;
      const isHovered = i === hovered ? 1 : 0;
      const towardX = dx * (pull * pull) * PULL * long * 0.02;
      const towardY = dy * (pull * pull) * PULL * long * 0.02;
      leanX[i]! += (towardX - leanX[i]!) * (pull > 0 ? GRAB : RELEASE);
      leanY[i]! += (towardY - leanY[i]!) * (pull > 0 ? GRAB : RELEASE);

      let push = 0;
      let dimTarget = 0;
      if (hovered >= 0 && i !== hovered) {
        let gap = Math.abs(i - hovered);
        gap = Math.min(gap, count - gap);
        const off = Math.max(0, 1 - gap / NEIGHBOUR_REACH);
        push = Math.sign(c.y - at[hovered]!.y || 1) * off * NEIGHBOUR_PUSH * long;
        dimTarget = off * NEIGHBOUR_DIM;
      }
      dim[i]! += (dimTarget - dim[i]!) * (dimTarget > dim[i]! ? GRAB : RELEASE);
      const wantSwell = pull * pull * SWELL + isHovered * NEIGHBOUR_SCALE - dimTarget * (NEIGHBOUR_SCALE / NEIGHBOUR_DIM);
      swell[i]! += (wantSwell - swell[i]!) * (wantSwell > swell[i]! ? GRAB : RELEASE);

      c.x += leanX[i]!;
      c.y += leanY[i]! + push;
      c.scale = (0.18 + 0.82 * spread) * (1 + swell[i]!);

      pos[i * 2] = c.x;
      pos[i * 2 + 1] = c.y;
      rot[i] = c.angle;
      state[i * 4] = c.scale;
      state[i * 4 + 1] = c.scale;
      state[i * 4 + 2] = 1 - dim[i]!;
      state[i * 4 + 3] = i;
    }

    for (let i = 0; i < count && strands < MAX_STRANDS; i++) {
      const j = (i + 1) % count;
      const a = at[i]!;
      const b = at[j]!;
      const gap = Math.hypot(b.x - a.x, b.y - a.y);
      const opening = (gap - short) / (short * STRAND_SNAP);
      if (opening > 1 || opening < -1) continue;
      const strength = Math.max(1 - spread, hovered === i || hovered === j ? 1 : 0);
      if (strength < 0.02) continue;
      const rEnd = short * 0.5 * STRAND * strength * (1 - clamp(opening, 0, 1));
      if (rEnd <= 0.5) continue;
      strandA[strands * 2] = a.x;
      strandA[strands * 2 + 1] = a.y;
      strandB[strands * 2] = b.x;
      strandB[strands * 2 + 1] = b.y;
      strandPar[strands * 4] = rEnd;
      strandPar[strands * 4 + 1] = rEnd * WAIST;
      strandPar[strands * 4 + 2] = SAG * long * clamp(opening, 0, 1);
      strandPar[strands * 4 + 3] = WELD * long;
      strands++;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindVertexArray(quad);
    gl.uniform2f(u('uResolution'), width, height);
    gl.uniform2f(u('uSize'), long, short);
    gl.uniform1f(u('uCorner'), CORNER * long);
    gl.uniform1f(u('uCount'), count);
    gl.uniform2fv(u('uCentre'), pos);
    gl.uniform1fv(u('uAngle'), rot);
    gl.uniform4fv(u('uCardState'), state);
    gl.uniform1f(u('uStrandCount'), strands);
    gl.uniform2fv(u('uStrandA'), strandA);
    gl.uniform2fv(u('uStrandB'), strandB);
    gl.uniform4fv(u('uStrandPar'), strandPar);
    gl.uniform1f(u('uFuse'), FUSE * long);
    gl.uniform1f(u('uJitter'), reduced ? 0 : WOBBLE * long * clamp(speed * 2 + (1 - spread), 0, 1));
    gl.uniform1f(u('uTime'), reduced ? 0 : clock);
    gl.uniform3f(u('uColor'), 1, 1, 1);
    gl.uniform1f(u('uCrossfade'), CROSSFADE * long);
    gl.uniform1f(u('uHasArt'), atlas ? 1 : 0);
    gl.uniform2f(u('uGrid'), COLS, Math.ceil(count / COLS));
    gl.uniform4f(u('uCursor'), mx, my, present, CURSOR_FUSE * long);
    gl.uniform4f(
      u('uWake'),
      CURSOR_REACH * long,
      reduced ? 0 : WAVE * long * clamp(pointerSpeed / 40, 0, 1),
      WAVE_FREQ / long,
      WAVE_SPEED,
    );
    gl.uniform1f(u('uLipDepth'), BAND * height);
    gl.uniform4f(u('uLip'), REFRACT * long, SQUEEZE, RIPPLE * long, RIPPLE_FREQ / long);
    gl.uniform1f(u('uFringe'), FRINGE);
    gl.uniform1f(u('uSheen'), SHEEN);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, atlas);
    gl.uniform1i(u('uAtlas'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  // O laço só corre com o anel na tela e a aba visível
  let visible = false;
  function wake(): void {
    if (running || !visible || document.hidden) return;
    running = true;
    previous = 0;
    frame = requestAnimationFrame(draw);
  }
  const sleep = () => {
    running = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };
  new IntersectionObserver(
    ([e]) => {
      if (e!.isIntersecting) request();
    },
    { rootMargin: '800px 0px' },
  ).observe(root);
  new IntersectionObserver(
    ([e]) => {
      visible = e!.isIntersecting;
      if (visible) {
        entering = true;
        wake();
      } else sleep();
    },
    { threshold: 0.25 },
  ).observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? sleep() : wake()));
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    sleep();
    root.classList.remove('is-gl'); // volta para a grade comum
  });
}
