'use client';

import {
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Radio, Sparkles, WalletCards } from 'lucide-react';
import { cn } from '@/lib/utils';

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
uniform vec2 u_resolution;
uniform vec2 u_pointer;
uniform float u_time;
out vec4 out_color;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), f.x),
    f.y
  );
}

void main() {
  vec2 uv = v_uv;
  vec2 focus = uv - u_pointer;
  focus.x *= u_resolution.x / max(u_resolution.y, 1.0);

  float grain = hash21(uv * u_resolution + u_time) - 0.5;
  float cloud = noise(uv * 4.2 + vec2(u_time * 0.025, -u_time * 0.018));
  float wave = sin((uv.x * 1.2 + uv.y * 0.72 + cloud * 0.22) * 18.0 - u_time * 0.32);
  float spotlight = exp(-length(focus) * 2.4);
  float ribbon = pow(max(0.0, 1.0 - abs(uv.y - 0.26 - uv.x * 0.18)), 16.0);

  vec3 base = mix(vec3(0.045, 0.026, 0.018), vec3(0.105, 0.060, 0.038), uv.y);
  vec3 copper = vec3(0.88, 0.31, 0.10);
  vec3 teal = vec3(0.10, 0.46, 0.54);
  float chroma = 0.5 + 0.5 * sin(
    (uv.x * 0.34 + uv.y * 0.19 + cloud * 0.08) * 18.0 - u_time * 0.18
  );
  vec3 spectrum = mix(copper, teal, chroma);
  vec3 silver = vec3(0.78, 0.68, 0.58) * ribbon;

  vec3 color = base;
  color += spectrum * (0.035 + spotlight * 0.13);
  color += silver * (0.035 + spotlight * 0.08);
  color += spectrum * wave * 0.012;
  color += grain * 0.018;
  color *= 0.94 + spotlight * 0.12;

  out_color = vec4(color, 1.0);
}`;

function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
) {
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

export function HolographicWalletCard({
  balance,
  lifetimeEarned,
  lifetimeSpent,
  className,
}: {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  className?: string;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({ x: 0.62, y: 0.34 });
  const drawRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      powerPreference: 'low-power',
    });
    if (!gl) return;

    const vertex = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertex || !fragment) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const position = gl.getAttribLocation(program, 'a_position');
    const resolution = gl.getUniformLocation(program, 'u_resolution');
    const pointer = gl.getUniformLocation(program, 'u_pointer');
    const time = gl.getUniformLocation(program, 'u_time');
    const startedAt = performance.now();
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    let frame = 0;
    let active = true;
    let lastFrame = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 1.6);
      const width = Math.max(1, Math.round(rect.width * ratio));
      const height = Math.max(1, Math.round(rect.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };

    const draw = () => {
      resize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      gl.enableVertexAttribArray(position);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform2f(pointer, pointerRef.current.x, pointerRef.current.y);
      gl.uniform1f(time, (performance.now() - startedAt) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    drawRef.current = draw;

    const render = (now: number) => {
      if (!active) return;
      if (now - lastFrame > 32) {
        draw();
        lastFrame = now;
      }
      frame = window.requestAnimationFrame(render);
    };

    const resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(canvas);
    draw();
    if (!reduceMotion) frame = window.requestAnimationFrame(render);

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      drawRef.current = null;
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, []);

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>) {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    pointerRef.current = { x, y: 1 - y };
    card.style.setProperty('--wallet-rx', `${(0.5 - y) * 8}deg`);
    card.style.setProperty('--wallet-ry', `${(x - 0.5) * 11}deg`);
    card.style.setProperty('--wallet-mx', `${x * 100}%`);
    card.style.setProperty('--wallet-my', `${y * 100}%`);
    drawRef.current?.();
  }

  function handlePointerLeave() {
    const card = cardRef.current;
    pointerRef.current = { x: 0.62, y: 0.34 };
    card?.style.setProperty('--wallet-rx', '0deg');
    card?.style.setProperty('--wallet-ry', '0deg');
    card?.style.setProperty('--wallet-mx', '62%');
    card?.style.setProperty('--wallet-my', '66%');
    drawRef.current?.();
  }

  return (
    <div className={cn('credit-wallet-stage', className)}>
      <section
        ref={cardRef}
        className="credit-holo-card"
        aria-label={`${balance.toLocaleString()} available credits`}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={
          {
            '--wallet-rx': '0deg',
            '--wallet-ry': '0deg',
            '--wallet-mx': '62%',
            '--wallet-my': '66%',
          } as CSSProperties
        }
      >
        <canvas ref={canvasRef} aria-hidden />
        <div className="credit-holo-light" aria-hidden />
        <div className="credit-holo-grid" aria-hidden />

        <div className="credit-wallet-content">
          <div className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-2.5 text-[11px] font-semibold tracking-[0.16em] text-white/68 uppercase">
              <span className="grid size-9 place-items-center rounded-xl border border-white/12 bg-white/8 backdrop-blur-md">
                <WalletCards className="size-4" />
              </span>
              Snackd creator wallet
            </span>
            <span className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.12em] text-white/58 uppercase">
              <Radio className="size-3.5" />
              Live balance
            </span>
          </div>

          <div className="credit-wallet-balance">
            <span className="text-[11px] font-medium tracking-[0.14em] text-white/48 uppercase">
              Available balance
            </span>
            <div className="mt-3 flex items-end justify-center gap-3">
              <strong className="text-[clamp(4.5rem,10vw,7.5rem)] leading-[0.8] font-semibold tracking-[-0.08em] text-white tabular-nums">
                {balance.toLocaleString()}
              </strong>
              <span className="pb-1 text-sm font-medium tracking-[0.04em] text-white/55">
                credits
              </span>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-5 border-t border-white/12 pt-5">
            <WalletMetric label="Lifetime added" value={lifetimeEarned} />
            <Sparkles className="mb-1 size-4 text-white/28" />
            <WalletMetric
              label="Lifetime used"
              value={lifetimeSpent}
              align="right"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function WalletMetric({
  label,
  value,
  align = 'left',
}: {
  label: string;
  value: number;
  align?: 'left' | 'right';
}) {
  return (
    <div className={align === 'right' ? 'text-right' : undefined}>
      <span className="block text-[9px] font-semibold tracking-[0.14em] text-white/40 uppercase">
        {label}
      </span>
      <b className="mt-1.5 block text-base font-medium text-white/82 tabular-nums">
        {value.toLocaleString()}
      </b>
    </div>
  );
}
