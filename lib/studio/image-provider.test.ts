import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { prepareStudioImageRequest } from './image-generation';
import { buildGeminiImagePrompt } from './image-provider';

describe('Gemini language-model image prompt', () => {
  it('sends text, URL references, and inline references as user file parts', () => {
    const request = prepareStudioImageRequest({
      modelId: 'google/gemini-3.1-flash-image',
      prompt: 'Preserve the character and change the location.',
      referenceImages: [
        'https://cdn.example.com/character.png',
        'data:image/webp;base64,AAAA',
      ],
    });
    assert.equal(request.providerCall.mode, 'language-model');
    if (request.providerCall.mode !== 'language-model') return;

    const messages = buildGeminiImagePrompt(request.providerCall);
    assert.deepEqual(messages, [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Preserve the character and change the location.\nGenerate exactly one image. Do not describe the image in text.',
          },
          {
            type: 'file',
            data: new URL('https://cdn.example.com/character.png'),
            mediaType: 'image',
          },
          {
            type: 'file',
            data: 'data:image/webp;base64,AAAA',
            mediaType: 'image/webp',
          },
        ],
      },
    ]);
  });
});
