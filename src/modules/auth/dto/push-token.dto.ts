import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const PushTokenSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório'),
});

export class PushTokenDto extends createZodDto(PushTokenSchema) {}
