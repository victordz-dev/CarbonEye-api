import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AlternarMonitoramentoSchema = z.object({
  monitoramento_ativo: z.boolean(),
});

export class AlternarMonitoramentoDto extends createZodDto(
  AlternarMonitoramentoSchema,
) {}
