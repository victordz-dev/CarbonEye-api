import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface UserSession {
  id: string;
  email: string;
}

export const GetUser = createParamDecorator(
  (
    data: keyof UserSession | undefined,
    ctx: ExecutionContext,
  ): UserSession | string | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user: UserSession }>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
