import { DesignProjectionService, type DesignInput, type ImageGenerationProvider } from './design';
import { normalizePhoto } from './images';
export async function runProjectionJob(
  image: Buffer,
  input: DesignInput,
  model: string,
  provider: ImageGenerationProvider,
  store: (output: Awaited<ReturnType<typeof normalizePhoto>>) => Promise<void>,
) {
  const generated = await new DesignProjectionService(provider).generateRoomProjection(
    image,
    input,
    model,
  );
  const output = await normalizePhoto(generated);
  await store(output);
  return { width: output.width, height: output.height };
}
