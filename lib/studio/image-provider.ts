import {
  generateImage,
  generateText,
  type GeneratedFile,
  type ModelMessage,
  type UserContent,
} from 'ai';
import type {
  PreparedLanguageImageCall,
  PreparedStudioImageRequest,
} from './image-generation';

export function buildGeminiImagePrompt(
  call: PreparedLanguageImageCall,
): ModelMessage[] {
  const content: UserContent = [
    {
      type: 'text',
      text: `${call.prompt}\nGenerate exactly one image. Do not describe the image in text.`,
    },
    ...call.referenceImages.map((source) => ({
      type: 'file' as const,
      data: source.startsWith('data:') ? source : new URL(source),
      mediaType: dataUrlMediaType(source) ?? 'image',
    })),
  ];
  return [{ role: 'user', content }];
}

export async function generatePreparedStudioImages(
  request: PreparedStudioImageRequest,
): Promise<GeneratedFile[]> {
  const call = request.providerCall;
  if (call.mode === 'image-model') {
    const result = await generateImage({
      model: call.model,
      prompt: call.prompt,
      n: call.n,
      size: call.size,
      aspectRatio: call.aspectRatio,
      maxImagesPerCall: call.maxImagesPerCall,
      providerOptions: call.providerOptions,
      maxRetries: 0,
    });
    return result.images;
  }

  const results = await Promise.all(
    Array.from({ length: call.count }, () =>
      generateText({
        model: call.model,
        prompt: buildGeminiImagePrompt(call),
        providerOptions: call.providerOptions,
        maxOutputTokens: 512,
        maxRetries: 0,
      }),
    ),
  );
  return results.map((result) => {
    const image = result.files.find((file) =>
      file.mediaType.startsWith('image/'),
    );
    if (!image) {
      throw new Error('Gemini completed without returning an image.');
    }
    return image;
  });
}

function dataUrlMediaType(source: string) {
  return /^data:([^;,]+)[;,]/i.exec(source)?.[1];
}
