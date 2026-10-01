import { z } from 'zod';
export const designStyles = [
  'Moderne',
  'Contemporain',
  'Scandinave',
  'Minimaliste',
  'Haussmannien rénové',
  'Industriel',
  'Chaleureux',
  'Haut de gamme',
  'Location meublée optimisée',
  'Colocation',
  'Courte durée',
  'Neutre pour revente',
  'Autre',
] as const;
export const renovationLevels = [
  'Home staging léger',
  'Rafraîchissement',
  'Rénovation standard',
  'Rénovation premium',
  'Rénovation lourde',
] as const;
export const designNotice =
  'Cette visualisation IA est indicative et ne remplace pas un devis, un plan technique ou une étude de faisabilité.';
export const designSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    photoId: z.string().min(1).max(100),
    scenarioId: z.string().min(1).max(100).nullable(),
    style: z.enum(designStyles),
    renovationLevel: z.enum(renovationLevels),
    prompt: z.string().trim().min(10).max(3000),
  })
  .strict();
export type DesignInput = z.infer<typeof designSchema>;
export const promptLibrary: Record<string, string> = {
  Cuisine:
    'Rénove cette cuisine avec façades claires, plan de travail bois, crédence élégante et éclairage chaleureux.',
  Salon:
    'Transforme ce salon en espace chaleureux et épuré : parquet clair, murs blancs cassés et mobilier contemporain.',
  'Salle de bain':
    'Modernise les revêtements, le meuble vasque et la robinetterie de cette salle de bain, en conservant ses ouvertures.',
  Chambre:
    'Transforme cette chambre en pièce apaisante, avec rangements intégrés et lumière douce.',
};
export function projectionPrompt(input: DesignInput) {
  return `Édite la photo fournie de la pièce réelle pour illustrer un projet de rénovation. Conserve autant que possible la géométrie apparente, la perspective, les murs et les ouvertures visibles. Ne crée pas de nouvelle fenêtre ou de nouvelle pièce. Le rendu est une projection visuelle indicative, pas un plan technique. Style : ${input.style}. Niveau : ${input.renovationLevel}. Ne déduis aucun prix, surface, amélioration de DPE ni faisabilité technique. Souhaits utilisateur : ${input.prompt}`;
}
export type ProjectionRequest = { image: Buffer; prompt: string; model: string };
export interface ImageGenerationProvider {
  readonly id: string;
  generateRoomProjection(input: ProjectionRequest): Promise<Buffer>;
}
export class DesignProjectionService {
  constructor(private provider: ImageGenerationProvider) {}
  generateRoomProjection(image: Buffer, input: DesignInput, model: string) {
    return this.provider.generateRoomProjection({ image, prompt: projectionPrompt(input), model });
  }
  async generateRoomVariations(image: Buffer, input: DesignInput, model: string, count: number) {
    z.number().int().min(1).max(3).parse(count);
    const output: Buffer[] = [];
    for (let i = 0; i < count; i++)
      output.push(await this.generateRoomProjection(image, input, model));
    return output;
  }
  generateBeforeAfterPreview(beforeUrl: string, afterUrl: string) {
    return { beforeUrl, afterUrl, notice: designNotice };
  }
}
export type GeneratedDesign = {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
  variationLabel: string;
  modelName: string;
  provider: string;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  favorite: boolean;
};
export type DesignProject = DesignInput & {
  id: string;
  roomId: string;
  createdAt: string;
  visuals: GeneratedDesign[];
};
