// Transição "morph" do hero: a foto atual se desfaz em retalhos de ruído (fbm) enquanto a próxima aparece.
// Um único passe de shader sobre duas texturas. O limiar de cada pixel vem do ruído, enviesado pelo brilho
// da foto que entra: as áreas claras dela "queimam" primeiro. As duas fotos deslizam em sentidos opostos,
// o que dá profundidade aos retalhos. WebGL puro, sem biblioteca (adaptado do componente MorphGallery).
// As fotos são do próprio site (mesma origem), então não há problema de CORS no envio para a GPU.
// Se o WebGL não existir ou o contexto cair, ok() devolve false e o carrossel volta à abertura em círculo.

const VERT = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
uniform sampler2D u_from;
uniform sampler2D u_to;
uniform float u_progress;
uniform vec2 u_resolution;
uniform float u_fromAspect;
uniform float u_toAspect;
uniform vec2 u_fromPos;
uniform vec2 u_toPos;
uniform float u_scale;
uniform float u_direction;
uniform float u_edge;
uniform float u_drift;
varying vec2 v_uv;

vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 v) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * snoise(v);
    v *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// O deslize empurra as coordenadas para fora da foto; espelhar evita faixas esticadas na borda
// (MIRRORED_REPEAT não é permitido em texturas que não são potência de dois no WebGL 1).
vec2 mirror(vec2 uv) { return 1.0 - abs(1.0 - mod(uv, 2.0)); }

// object-fit: cover com object-position (pos em 0..1, y medido de cima, como no CSS)
vec2 coverUV(vec2 uv, float imgAspect, vec2 pos) {
  float canvasAspect = u_resolution.x / u_resolution.y;
  vec2 s = (canvasAspect > imgAspect) ? vec2(1.0, imgAspect / canvasAspect) : vec2(canvasAspect / imgAspect, 1.0);
  vec2 off = (1.0 - s) * vec2(pos.x, 1.0 - pos.y);
  return mirror(uv * s + off);
}

void main() {
  float adjusted = u_progress * (1.0 + 2.0 * u_edge) - u_edge;
  float noise = fbm(v_uv * u_scale + vec2(0.0, u_progress * u_direction)) * 0.5 + 0.5;
  noise = smoothstep(0.0, 2.0, length(texture2D(u_to, coverUV(v_uv, u_toAspect, u_toPos)).rgb) + noise);
  float mixFactor = 1.0 - smoothstep(adjusted - u_edge, adjusted + u_edge, noise);
  vec2 fromUV = coverUV(v_uv + vec2(0.0, noise * u_progress * u_drift * u_direction), u_fromAspect, u_fromPos);
  vec2 toUV = coverUV(v_uv + vec2(0.0, noise * (1.0 - u_progress) * -0.5 * u_drift * u_direction), u_toAspect, u_toPos);
  gl_FragColor = mix(texture2D(u_from, fromUV), texture2D(u_to, toUV), mixFactor);
}
`;

/** Quíntica de entrada e saída: a dissolução começa e termina parada e acelera no meio. */
const ease = (t: number) => {
  const x = Math.min(Math.max(t, 0), 1);
  return x < 0.5 ? 16 * x ** 5 : 1 - (-2 * x + 2) ** 5 / 2;
};

/** "50% 78%" → [0.5, 0.78] */
export const parsePos = (v: string): [number, number] => {
  const [x = '50%', y = '50%'] = v.trim().split(/\s+/);
  return [parseFloat(x) / 100 || 0.5, parseFloat(y) / 100 || 0.5];
};

export interface MorphOptions {
  duration?: number;
  noiseScale?: number;
  edge?: number;
  drift?: number;
}

export interface Morph {
  ok(): boolean;
  run(
    from: HTMLImageElement,
    to: HTMLImageElement,
    fromPos: [number, number],
    toPos: [number, number],
    direction: number,
  ): Promise<void>;
}

export function createMorph(host: HTMLElement, opts: MorphOptions = {}): Morph | null {
  const { duration = 1500, noiseScale = 3.5, edge = 0.15, drift = 0.5 } = opts;
  const canvas = document.createElement('canvas');
  canvas.className = 'ap-morph';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false });
  if (!gl) return null;

  let alive = true;
  let program: WebGLProgram;
  const u: Record<string, WebGLUniformLocation | null> = {};
  try {
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      return s;
    };
    program = gl.createProgram()!;
    const vs = sh(gl.VERTEX_SHADER, VERT);
    const fs = sh(gl.FRAGMENT_SHADER, FRAG);
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('link');
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['from', 'to', 'progress', 'resolution', 'fromAspect', 'toAspect', 'fromPos', 'toPos', 'scale', 'direction', 'edge', 'drift'])
      u[n] = gl.getUniformLocation(program, 'u_' + n);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  } catch {
    return null;
  }

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    alive = false;
    canvas.style.visibility = 'hidden';
  });
  host.appendChild(canvas);

  // Uma textura por foto, refeita se o navegador trocar o arquivo (outra largura do srcset)
  const cache = new WeakMap<HTMLImageElement, { tex: WebGLTexture; src: string }>();
  const texture = (img: HTMLImageElement) => {
    const hit = cache.get(img);
    if (hit && hit.src === img.currentSrc) return hit.tex;
    const tex = hit?.tex ?? gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    cache.set(img, { tex, src: img.currentSrc });
    return tex;
  };

  const resize = () => {
    // No celular o ruído em 5 oitavas pesa: limita a densidade de pixels
    const cap = matchMedia('(pointer: coarse)').matches ? 1.25 : 1.75;
    const dpr = Math.min(window.devicePixelRatio || 1, cap);
    const w = Math.round(host.clientWidth * dpr);
    const h = Math.round(host.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };

  return {
    ok: () => alive,
    run(from, to, fromPos, toPos, direction) {
      return new Promise((resolve) => {
        try {
          resize();
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, texture(from));
          gl.uniform1i(u.from!, 0);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, texture(to));
          gl.uniform1i(u.to!, 1);
        } catch {
          alive = false;
          resolve();
          return;
        }
        gl.uniform2f(u.resolution!, canvas.width, canvas.height);
        gl.uniform1f(u.fromAspect!, from.naturalWidth / Math.max(from.naturalHeight, 1));
        gl.uniform1f(u.toAspect!, to.naturalWidth / Math.max(to.naturalHeight, 1));
        gl.uniform2f(u.fromPos!, fromPos[0], fromPos[1]);
        gl.uniform2f(u.toPos!, toPos[0], toPos[1]);
        gl.uniform1f(u.scale!, noiseScale);
        gl.uniform1f(u.direction!, direction);
        gl.uniform1f(u.edge!, edge);
        gl.uniform1f(u.drift!, drift);

        const t0 = performance.now();
        const frame = (now: number) => {
          if (!alive) return resolve();
          const p = ease((now - t0) / duration);
          gl.uniform1f(u.progress!, p);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          if (p === 0) canvas.classList.add('on'); // o primeiro quadro já é a foto atual: troca sem salto
          if (p < 1) requestAnimationFrame(frame);
          else resolve();
        };
        gl.uniform1f(u.progress!, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        canvas.classList.add('on');
        requestAnimationFrame(frame);
      });
    },
  };
}

/** Esconde o canvas depois que a foto nova já está por baixo. */
export const hideMorph = (host: HTMLElement): void =>
  host.querySelector('.ap-morph')?.classList.remove('on');
