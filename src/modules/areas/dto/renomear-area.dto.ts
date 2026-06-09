import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const RenomearAreaSchema = z.object({
  nome: z
    .string()
    .min(1, 'O nome não pode estar vazio.')
    .max(255, 'O nome deve conter no máximo 255 caracteres.'),
});

export class RenomearAreaDto extends createZodDto(RenomearAreaSchema) {}
