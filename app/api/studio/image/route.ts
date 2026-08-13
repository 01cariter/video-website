import { generateImage } from 'ai';
import { friendlyAiError } from '@/lib/studio/errors';
import { STUDIO_IMAGE_MODEL } from '@/lib/studio/models';

export const maxDuration = 60;

const IMAGE_ASPECTS = new Set([
  '1:1',
  '16:9',
  '9:16',
  '4:3',
  '3:4',
  '3:2',
  '2:3',
  '2:1',
  '1:2',
  '19.5:9',
  '9:19.5',
  '20:9',
  '9:20',
  'auto',
]);

export async function POST(req: Request) {
  const { prompt, aspect = '1:1', n = 1, refSrc } = (await req.json()) as {
    prompt?: string;
    aspect?: string;
    n?: number;
    refSrc?: string;
  };
  if (!prompt?.trim()) {
    return Response.json({ error: '请先填写提示词。' }, { status: 400 });
  }

  const count = Math.min(4, Math.max(1, Number(n) || 1));
  const aspectRatio = IMAGE_ASPECTS.has(aspect) ? (aspect as `${number}:${number}` | 'auto') : '1:1';

  try {
    const result = await generateImage({
      model: STUDIO_IMAGE_MODEL,
      prompt: refSrc
        ? { text: prompt.trim(), images: [refSrc] }
        : prompt.trim(),
      n: count,
      aspectRatio: aspectRatio === 'auto' ? undefined : (aspectRatio as `${number}:${number}`),
    });
    const urls = result.images.map((image) => `data:image/png;base64,${image.base64}`);
    return Response.json({ url: urls[0], urls });
  } catch (error) {
    const message = error instanceof Error ? error.message : '图片生成失败';
    return Response.json({ error: friendlyAiError(message) }, { status: 502 });
  }
}
