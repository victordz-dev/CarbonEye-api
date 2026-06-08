import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().email('O e-mail deve ser válido.'),
  senha: z.string().min(1, 'Senha é obrigatória'),
});

export class LoginDto extends createZodDto(LoginSchema) {}
