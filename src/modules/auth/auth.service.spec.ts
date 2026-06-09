import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Usuario } from '../../entities/usuario.entity';
import { JwtService } from '@nestjs/jwt';
import { LogsService } from '../logs/logs.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let mockUsuarioRepository: Record<string, jest.Mock>;
  let mockJwtService: Partial<Record<keyof JwtService, jest.Mock>>;
  let mockLogsService: Partial<Record<keyof LogsService, jest.Mock>>;

  beforeEach(async () => {
    mockUsuarioRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-token'),
    };

    mockLogsService = {
      registrarLog: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(Usuario),
          useValue: mockUsuarioRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: LogsService,
          useValue: mockLogsService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should throw ConflictException if email exists', async () => {
      mockUsuarioRepository.findOne.mockResolvedValueOnce({
        id: '1',
        email: 'test@test.com',
      });
      await expect(
        service.register({
          nome: 'Test',
          email: 'test@test.com',
          cpf: '12345678901',
          senha: 'password',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should register a new user successfully', async () => {
      mockUsuarioRepository.findOne.mockResolvedValue(null);
      mockUsuarioRepository.create.mockReturnValue({
        id: '1',
        email: 'test@test.com',
      });
      mockUsuarioRepository.save.mockResolvedValue({
        id: '1',
        nome: 'Test',
        email: 'test@test.com',
        cpf: '12345678901',
      });

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-pass');

      const result = await service.register({
        nome: 'Test',
        email: 'test@test.com',
        cpf: '12345678901',
        senha: 'password',
      });
      expect(result.token).toBe('mock-token');
      expect(result.usuario.email).toBe('test@test.com');
      expect(mockLogsService.registrarLog).toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    it('should throw UnauthorizedException if wrong current password', async () => {
      mockUsuarioRepository.findOne.mockResolvedValue({
        id: '1',
        email: 'test@test.com',
        senha: 'hashed',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.updateProfile('1', {
          novaSenha: 'newpass',
          senhaAtual: 'wrong',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
