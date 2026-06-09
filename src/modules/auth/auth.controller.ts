import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService, AuthResponse } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { Request } from 'express';
import { Put, Patch, Delete, UseGuards, Req } from '@nestjs/common';
import { PushTokenDto } from './dto/push-token.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Req() req: Request,
    @Body() dto: UpdateProfileDto,
  ): Promise<AuthResponse> {
    const userId = (req.user as any).id;
    return this.authService.updateProfile(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('profile')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@Req() req: Request): Promise<void> {
    const userId = (req.user as any).id;
    await this.authService.deleteAccount(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('push-token')
  @HttpCode(HttpStatus.OK)
  async updatePushToken(
    @Req() req: Request,
    @Body() dto: PushTokenDto,
  ): Promise<{ message: string }> {
    const userId = (req.user as any).id;
    await this.authService.updatePushToken(userId, dto.token);
    return { message: 'Push token atualizado com sucesso' };
  }
}
