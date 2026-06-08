import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { cpf } from 'cpf-cnpj-validator';

const RegisterSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  cpf: z.string().refine((val) => cpf.isValid(val), { message: 'CPF inválido.' }),
  email: z.string().email('O e-mail deve ser válido.'),
  senha: z.string().min(6, 'A senha deve conter no mínimo 6 caracteres.').max(20, 'A senha deve conter no máximo 20 caracteres.'),
});

export class RegisterDto extends createZodDto(RegisterSchema) {}
