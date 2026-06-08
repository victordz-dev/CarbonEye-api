import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CoordenadaSchema = z.object({
  latitude: z.number(),
  longitude: z.number()
});

export const AnalisarAreaSchema = z.object({
  poligono: z.array(CoordenadaSchema).min(3, 'O polígono deve conter pelo menos 3 pontos.')
});

export class CoordenadaDto extends createZodDto(CoordenadaSchema) {}
export class AnalisarAreaDto extends createZodDto(AnalisarAreaSchema) {}
