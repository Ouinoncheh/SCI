import { z } from 'zod';
import type { ImageGenerationProvider, ProjectionRequest } from '../visualization/design';
export const supportedImageModels = [
  'gpt-image-1.5',
  'gpt-image-2',
  'gpt-image-2.5-sunburst',
  'gpt-image-2.5-flare',
];
export function designConfiguration() {
  const configured = process.env.OPENAI_IMAGE_MODEL ?? '';
  const model = supportedImageModels.includes(configured) ? configured : '';
  return {
    ready:
      process.env.DESIGN_GENERATION_ENABLED === 'true' &&
      Boolean(process.env.OPENAI_API_KEY) &&
      supportedImageModels.includes(model),
    model,
    provider: 'OpenAI',
    dailyLimit: 10,
  };
}
export class OpenAIImageProvider implements ImageGenerationProvider {
  readonly id = 'openai';
  constructor(private key: string) {}
  async generateRoomProjection(input: ProjectionRequest) {
    if (!supportedImageModels.includes(input.model)) throw new Error('Modèle non configuré');
    const form = new FormData();
    form.set('model', input.model);
    form.set('prompt', input.prompt);
    form.set('n', '1');
    form.set('size', 'auto');
    form.set('quality', 'medium');
    form.set('output_format', 'webp');
    form.set('input_fidelity', 'high');
    form.append(
      'image[]',
      new Blob([new Uint8Array(input.image)], { type: 'image/webp' }),
      'room.webp',
    );
    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.key}` },
      body: form,
      signal: AbortSignal.timeout(150000),
      redirect: 'error',
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('Génération refusée ou indisponible');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Résultat vide');
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 12_000_000) {
        await reader.cancel();
        throw new Error('Résultat trop volumineux');
      }
      chunks.push(value);
    }
    const data = z
      .object({
        data: z.array(z.object({ b64_json: z.string().min(1).max(11_000_000) })).length(1),
      })
      .parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    return Buffer.from(data.data[0].b64_json, 'base64');
  }
}
