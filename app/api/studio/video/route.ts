import { experimental_generateVideo as generateVideo } from 'ai';
import { friendlyAiError } from '@/lib/studio/errors';
import { videoPixelSize } from '@/lib/studio/model-catalog';
import { STUDIO_VIDEO_MODEL } from '@/lib/studio/models';

export const maxDuration = 300;

const VIDEO_ASPECTS = new Set(['16:9', '4:3', '1:1', '3:4', '9:16', '21:9']);

export async function POST(req: Request) {
  const {
    prompt,
    aspect = '16:9',
    duration = 5,
    videoResolution = '720p',
    generateAudio = false,
    refSrc,
  } = (await req.json()) as {
    prompt?: string;
    aspect?: string;
    duration?: number;
    videoResolution?: '480p' | '720p';
    generateAudio?: boolean;
    refSrc?: string;
  };
  if (!prompt?.trim()) {
    return Response.json({ error: '请先填写提示词。' }, { status: 400 });
  }

  const aspectRatio = VIDEO_ASPECTS.has(aspect) ? (aspect as `${number}:${number}`) : '16:9';
  const seconds = Math.min(15, Math.max(4, Number(duration) || 5));
  const resolution = videoResolution === '480p' ? '480p' : '720p';

  try {
    const { video } = await generateVideo({
      model: STUDIO_VIDEO_MODEL,
      prompt: refSrc ? { image: refSrc, text: prompt.trim() } : prompt.trim(),
      aspectRatio: refSrc ? 'adaptive' : aspectRatio,
      duration: seconds,
      resolution: videoPixelSize(aspectRatio, resolution),
      providerOptions: {
        bytedance: { generateAudio: Boolean(generateAudio) },
      },
    });
    const mediaType = video.mediaType || 'video/mp4';
    return Response.json({ url: `data:${mediaType};base64,${video.base64}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : '视频生成失败';
    return Response.json({ error: friendlyAiError(message) }, { status: 502 });
  }
}
