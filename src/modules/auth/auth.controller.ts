import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService, AuthResponse } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Put, Patch, Delete, UseGuards } from '@nestjs/common';
import { PushTokenDto } from './dto/push-token.dto';
import { GetUser } from '../../decorators/get-user.decorator';

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
  @ApiBearerAuth()
  @Put('profile')
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @GetUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<AuthResponse> {
    return this.authService.updateProfile(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('profile')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@GetUser('id') userId: string): Promise<void> {
    await this.authService.deleteAccount(userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch('push-token')
  @HttpCode(HttpStatus.OK)
  async updatePushToken(
    @GetUser('id') userId: string,
    @Body() dto: PushTokenDto,
  ): Promise<{ message: string }> {
    await this.authService.updatePushToken(userId, dto.token);
    return { message: 'Push token atualizado com sucesso' };
  }
}
