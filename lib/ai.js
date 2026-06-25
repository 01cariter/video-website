import 'server-only';
import { generateText, generateImage } from 'ai';

// ============================================================================
// Vercel AI Gateway wrapper.
//
// Auth is automatic on Vercel (OIDC) or via AI_GATEWAY_API_KEY locally. When a
// plain string model id is passed to the AI SDK, requests route through the
// Gateway. We default to a small, cheap model and allow an env override.
//
// Every call degrades gracefully: if the Gateway is unavailable (no credits,
// no token, network error) we return a deterministic heuristic fallback so the
// canvas + agent stay usable in demo mode.
// ============================================================================

export const AI_MODEL = process.env.AI_GATEWAY_MODEL || 'openai/gpt-4o-mini';
export const AI_IMAGE_MODEL = process.env.AI_GATEWAY_IMAGE_MODEL || 'google/imagen-4.0-fast-generate-001';

export function aiConfigured() {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

// Low-level text completion with a hard timeout. Throws on failure.
async function complete({ system, prompt, temperature = 0.7, maxOutputTokens = 900 }) {
  const { text } = await generateText({
    model: AI_MODEL,
    system,
    prompt,
    temperature,
    // The Gateway rejects values < 16, so clamp to a safe minimum.
    maxOutputTokens: Math.max(16, maxOutputTokens),
    abortSignal: AbortSignal.timeout(28_000),
  });
  return text.trim();
}

// Ask for JSON and parse defensively (strips ``` fences / leading prose).
function parseJSON(text) {
  if (!text) return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.search(/[[{]/);
  if (start > 0) t = t.slice(start);
  const lastObj = t.lastIndexOf('}');
  const lastArr = t.lastIndexOf(']');
  const end = Math.max(lastObj, lastArr);
  if (end >= 0) t = t.slice(0, end + 1);
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

async function completeJSON(args) {
  const text = await complete({ ...args, temperature: args.temperature ?? 0.6 });
  return parseJSON(text);
}

// ---------------------------------------------------------------------------
// Deterministic fallbacks (used when the Gateway is unavailable)
// ---------------------------------------------------------------------------

function fallbackScenes(idea) {
  const base = (idea || 'a short cinematic video').trim();
  const beats = [
    { title: 'Opening hook', shot: 'Wide establishing shot', mood: 'intriguing' },
    { title: 'Rising action', shot: 'Medium tracking shot', mood: 'building' },
    { title: 'Turning point', shot: 'Close-up, shallow depth', mood: 'tense' },
    { title: 'Resolution', shot: 'Slow pull-back, golden hour', mood: 'satisfying' },
  ];
  return beats.map((b, i) => ({
    title: `${i + 1}. ${b.title}`,
    prompt: `${b.shot} of ${base}. ${b.mood} tone, cinematic lighting, 35mm film look, high detail.`,
    duration: '5s',
  }));
}

function fallbackStyles(idea) {
  const base = (idea || 'the scene').trim();
  return [
    { label: 'Cinematic', prompt: `${base}, anamorphic lens, teal-and-orange grade, volumetric light, film grain.` },
    { label: 'Anime', prompt: `${base}, Studio-Ghibli inspired anime, hand-painted backgrounds, soft cel shading.` },
    { label: '3D / Pixar', prompt: `${base}, stylised 3D render, Pixar-style, soft global illumination, subsurface scattering.` },
    { label: 'Documentary', prompt: `${base}, naturalistic documentary look, handheld, available light, realistic.` },
  ];
}

// ---------------------------------------------------------------------------
// Agent capabilities
// ---------------------------------------------------------------------------

const AGENT_SYSTEM = `You are "updream", an AI creative director embedded in a node-based video canvas.
You help users go from a one-line idea to scripts, storyboards and shot-by-shot video prompts.
Be concise, practical and encouraging. Write in the same language as the user (Chinese or English).`;

// Freeform chat / brainstorm / prompt enhancement → returns { reply }
export async function agentChat({ action, input, context }) {
  const ctx = context?.summary ? `\n\nCanvas context: ${context.summary}` : '';
  let system = AGENT_SYSTEM;
  let prompt = input || '';

  if (action === 'prompt') {
    system += '\nTask: rewrite the user input into ONE vivid, production-ready text-to-video prompt (camera, lighting, mood, subject, motion). Output only the improved prompt.';
  } else if (action === 'brainstorm') {
    system += '\nTask: brainstorm. Offer 4-6 distinct creative angles/concepts as a short bulleted list, each one line.';
  } else {
    system += '\nTask: have a helpful conversation about the user\'s video project.';
  }

  try {
    const reply = await complete({ system, prompt: prompt + ctx });
    return { reply, source: 'ai' };
  } catch {
    if (action === 'prompt') {
      return { reply: `${input}, cinematic wide shot, soft natural light, shallow depth of field, smooth camera motion, highly detailed, 4k.`, source: 'fallback' };
    }
    if (action === 'brainstorm') {
      return {
        reply: `Here are a few directions for "${input}":\n• A bold visual metaphor opening\n• A character-driven micro-story\n• A fast-cut montage with rhythm\n• An unexpected twist ending\n• A calm, atmospheric mood piece`,
        source: 'fallback',
      };
    }
    return { reply: `I can help turn "${input || 'your idea'}" into scripts, storyboards and shots. Try the quick actions below to brainstorm, generate styles, or build a full storyboard.`, source: 'fallback' };
  }
}

// Different style variations → returns { reply, styles: [{label, prompt}] }
export async function agentStyles({ input, context }) {
  const subject = input || context?.summary || 'the current scene';
  const system = `${AGENT_SYSTEM}
Task: produce 4 distinct visual STYLE variations of the subject.
Respond ONLY with JSON: {"reply":"<one short sentence>","styles":[{"label":"<style name>","prompt":"<full text-to-video prompt in that style>"}]}`;
  try {
    const obj = await completeJSON({ system, prompt: `Subject: ${subject}` });
    if (obj?.styles?.length) return { ...obj, source: 'ai' };
  } catch {
    /* fall through */
  }
  return { reply: `Generated 4 style variations for "${subject}".`, styles: fallbackStyles(subject), source: 'fallback' };
}

// One sentence → script → storyboard shots → { reply, scenes:[{title,prompt,duration}] }
export async function agentPipeline({ input, context }) {
  const idea = input || context?.summary || 'a short film';
  const system = `${AGENT_SYSTEM}
Task: expand a ONE-LINE idea into a short shooting plan. First a 2-3 sentence logline, then 4-6 storyboard shots.
Respond ONLY with JSON:
{"reply":"<2-3 sentence logline/script summary>","scenes":[{"title":"<shot label>","prompt":"<text-to-video prompt: camera, action, lighting, mood>","duration":"5s"}]}`;
  try {
    const obj = await completeJSON({ system, prompt: `Idea: ${idea}`, maxOutputTokens: 1100 });
    if (obj?.scenes?.length) return { ...obj, source: 'ai' };
  } catch {
    /* fall through */
  }
  return {
    reply: `Here's a 4-shot storyboard for "${idea}". Each shot was added to the canvas — select one and hit generate.`,
    scenes: fallbackScenes(idea),
    source: 'fallback',
  };
}

// Map a UI aspect ratio to a generation-friendly size / aspectRatio.
function ratioToSize(ratio) {
  if (ratio === '9:16') return { aspectRatio: '9:16', w: 720, h: 1280 };
  if (ratio === '1:1') return { aspectRatio: '1:1', w: 1024, h: 1024 };
  return { aspectRatio: '16:9', w: 1280, h: 720 };
}

// Try to produce a real key-frame image through the Gateway. Returns a data
// URL on success, or null so the caller can fall back to a placeholder poster.
async function generatePoster(prompt, ratio) {
  const { aspectRatio } = ratioToSize(ratio);
  try {
    const { image } = await generateImage({
      model: AI_IMAGE_MODEL,
      prompt,
      aspectRatio,
      abortSignal: AbortSignal.timeout(55_000),
    });
    if (image?.base64) {
      const mime = image.mediaType || 'image/png';
      return `data:${mime};base64,${image.base64}`;
    }
  } catch {
    /* fall through to placeholder */
  }
  return null;
}

// Generate a single node's result (text-to-video stand-in).
// Produces an AI-written cinematic caption + a real AI-generated key frame
// (falls back to a deterministic placeholder poster when image gen is off).
export async function generateNode({ prompt, model, mode, ratio, duration }) {
  const clean = (prompt || '').trim() || 'an abstract cinematic moment';
  const framing = mode === '首尾帧'
    ? 'First/last frame anchored composition. '
    : 'Cinematic single key frame. ';
  const imagePrompt = `${framing}${clean}. Cinematic lighting, film still, high detail, 35mm look.`;

  let caption = '';
  const [captionRes, poster] = await Promise.all([
    complete({
      system: `${AGENT_SYSTEM}\nTask: in ONE sentence, describe the key frame this video prompt would produce. Vivid, visual, present tense.`,
      prompt: clean,
      maxOutputTokens: 120,
      temperature: 0.8,
    }).catch(() => ''),
    generatePoster(imagePrompt, ratio),
  ]);
  caption = captionRes || `A ${mode === '首尾帧' ? 'frame-anchored' : 'cinematic'} take: ${clean}`;

  if (poster) {
    return { caption, poster, model, ratio, duration, source: 'ai' };
  }
  const seed = encodeURIComponent(clean.slice(0, 60));
  const { w, h } = ratioToSize(ratio);
  return {
    caption,
    poster: `https://picsum.photos/seed/${seed}/${w}/${h}`,
    model,
    ratio,
    duration,
    source: captionRes ? 'ai' : 'fallback',
  };
}
