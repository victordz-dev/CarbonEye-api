import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CoordenadaSchema } from './analisar-area.dto';

export const SiriDetalhesSchema = z.object({
  vegetacao: z.number(),
  historico: z.number(),
  incendios: z.number(),
  clima: z.number(),
});

export const SiriCompletoSchema = z.object({
  pontuacaoTotal: z.number(),
  classificacao: z.string(),
  detalhes: SiriDetalhesSchema,
});

export const SalvarAreaSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  poligono: z.array(CoordenadaSchema).min(3, 'O polígono deve conter pelo menos 3 pontos.'),
  monitoramento_ativo: z.boolean(),
  siri_inicial: z.number(),
  agro_polygon_id: z.string().optional(),
  siri_completo: SiriCompletoSchema.optional(),
});

export class SiriDetalhesDto extends createZodDto(SiriDetalhesSchema) {}
export class SiriCompletoDto extends createZodDto(SiriCompletoSchema) {}
export class SalvarAreaDto extends createZodDto(SalvarAreaSchema) {}
