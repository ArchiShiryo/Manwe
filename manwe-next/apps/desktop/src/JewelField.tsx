// Fond génératif du thème « Jewel case » (maquette 13) : des lignes de
// balayage horizontales, ondulées et postérisées, qui prennent la couleur du
// contexte des liens voisins et se tordent d'autant plus que le lien est
// récent et fort. Shader WebGL ; image fixe si l'utilisateur réduit les
// animations ; dégradé CSS si WebGL est indisponible. Purement décoratif.
import { useEffect, useRef, useState } from "react";

export type FieldSegment = {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  color: [number, number, number];
  /** 0 à 1 : récence et poids du lien. */
  weight: number;
};

const MAX_SEGMENTS = 32;

const VERTEX = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAGMENT = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uScale;
uniform vec2 uOffset;
uniform vec2 uFocus;
uniform int uCount;
uniform vec4 uSeg[${MAX_SEGMENTS}];
uniform vec4 uCol[${MAX_SEGMENTS}];

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float segDist(vec2 p, vec2 a, vec2 b){
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  return length(pa - ba * h);
}

void main(){
  // Coordonnées en unités du schéma (viewBox), origine en haut à gauche.
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 p = (px - uOffset) / uScale;
  // Pixels « posterisés » de 4 × 5 unités écran, comme la maquette.
  vec2 cell = vec2(floor(px.x / 4.0) * 4.0, px.y);
  vec2 q = (cell - uOffset) / uScale;

  float best = 1e9;
  vec3 tint = vec3(0.0);
  float weight = 0.0;
  for (int i = 0; i < ${MAX_SEGMENTS}; i++) {
    if (i >= uCount) break;
    float d = segDist(q, uSeg[i].xy, uSeg[i].zw);
    if (d < best) { best = d; tint = uCol[i].rgb; weight = uCol[i].a; }
  }
  float reach = 120.0;
  float f = best < reach ? pow(1.0 - best / reach, 1.5) * weight : 0.0;
  float n = noise(q * 0.012);

  // Ligne de balayage toutes les 5 unités, déplacée par une onde.
  float wave = sin(q.x * 0.035 + uTime * 1.8 + n * 9.0) * (1.0 + 7.0 * f);
  float y = px.y + wave * uScale;
  float phase = mod(y, 5.0);
  float line = smoothstep(0.0, 0.6, phase) * (1.0 - smoothstep(1.4, 2.0, phase));

  // Bandes postérisées qui dérivent depuis le focus.
  float dist = distance(q, uFocus) / 840.0;
  float v = (sin(6.2831853 * (uTime * 0.375 + n * 1.6 + dist * 1.2)) + 1.0) * 0.5;
  float band = floor(v * 4.0) / 3.0;

  vec3 lilac = vec3(158.0, 170.0, 213.0) / 255.0;
  bool tinted = f > 0.02;
  vec3 color = tinted ? tint : lilac;
  float alpha = tinted ? 0.04 + band * (0.06 + 0.6 * f) : 0.025 + band * 0.07;
  alpha *= line;
  gl_FragColor = vec4(color * alpha, alpha);
}
`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function JewelField({
  segments,
  width,
  height,
  focus,
}: {
  segments: FieldSegment[];
  /** Dimensions du viewBox du schéma (preserveAspectRatio « meet »). */
  width: number;
  height: number;
  focus: { x: number; y: number };
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const data = useRef({ segments, width, height, focus });
  data.current = { segments, width, height, focus };
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const gl = element.getContext("webgl", {
      premultipliedAlpha: true,
      antialias: false,
    });
    const vertex = gl && compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = gl && compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl?.createProgram();
    if (!gl || !vertex || !fragment || !program) {
      setFallback(true);
      return;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setFallback(true);
      return;
    }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const uniform = (name: string) => gl.getUniformLocation(program, name);
    const u = {
      res: uniform("uRes"),
      time: uniform("uTime"),
      scale: uniform("uScale"),
      offset: uniform("uOffset"),
      focus: uniform("uFocus"),
      count: uniform("uCount"),
      seg: uniform("uSeg"),
      col: uniform("uCol"),
    };
    const still = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const start = performance.now();
    let frame = 0;

    const draw = () => {
      const {
        segments: list,
        width: vw,
        height: vh,
        focus: center,
      } = data.current;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.round(element.clientWidth * ratio));
      const h = Math.max(1, Math.round(element.clientHeight * ratio));
      if (element.width !== w || element.height !== h) {
        element.width = w;
        element.height = h;
      }
      gl.viewport(0, 0, w, h);
      const scale = Math.min(w / vw, h / vh);
      const seg = new Float32Array(MAX_SEGMENTS * 4);
      const col = new Float32Array(MAX_SEGMENTS * 4);
      list.slice(0, MAX_SEGMENTS).forEach((item, index) => {
        seg.set([item.ax, item.ay, item.bx, item.by], index * 4);
        col.set(
          [
            item.color[0] / 255,
            item.color[1] / 255,
            item.color[2] / 255,
            item.weight,
          ],
          index * 4,
        );
      });
      gl.uniform2f(u.res, w, h);
      gl.uniform1f(u.time, still ? 0 : (performance.now() - start) / 1000);
      gl.uniform1f(u.scale, scale);
      gl.uniform2f(u.offset, (w - vw * scale) / 2, (h - vh * scale) / 2);
      gl.uniform2f(u.focus, center.x, center.y);
      gl.uniform1i(u.count, Math.min(list.length, MAX_SEGMENTS));
      gl.uniform4fv(u.seg, seg);
      gl.uniform4fv(u.col, col);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const loop = () => {
      if (!document.hidden) draw();
      frame = requestAnimationFrame(loop);
    };
    if (still) {
      draw();
      const observer = new ResizeObserver(draw);
      observer.observe(element);
      return () => observer.disconnect();
    }
    loop();
    return () => cancelAnimationFrame(frame);
  }, []);

  if (fallback)
    return <div className="jewel-field jewel-field-fallback" aria-hidden />;
  return <canvas ref={canvas} className="jewel-field" aria-hidden />;
}
