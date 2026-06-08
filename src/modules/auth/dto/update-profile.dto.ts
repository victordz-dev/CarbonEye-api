import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UpdateProfileSchema = z.object({
  nome: z.string().optional(),
  email: z.string().email('O e-mail deve ser válido.').optional(),
  senhaAtual: z.string().optional(),
  novaSenha: z.string().min(6, 'A nova senha deve ter no mínimo 6 caracteres.').optional(),
});

export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) {}
