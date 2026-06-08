import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '../../entities/usuario.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { LogsService } from '../logs/logs.service';
import { NivelLog, OrigemLog } from '../../entities/sistemalog.entity';

export interface AuthResponse {
  token: string;
  usuario: {
    id: string;
    nome: string;
    email: string;
    cpf: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    private readonly jwtService: JwtService,
    private readonly logsService: LogsService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existingEmail = await this.usuarioRepository.findOne({
      where: { email: dto.email },
    });
    if (existingEmail) {
      throw new ConflictException('E-mail já cadastrado.');
    }

    const existingCpf = await this.usuarioRepository.findOne({
      where: { cpf: dto.cpf },
    });
    if (existingCpf) {
      throw new ConflictException('CPF já cadastrado.');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedSenha = await bcrypt.hash(dto.senha, salt);

    const novoUsuario = this.usuarioRepository.create({
      nome: dto.nome,
      cpf: dto.cpf,
      email: dto.email,
      senha: hashedSenha,
    });

    const usuarioSalvo = await this.usuarioRepository.save(novoUsuario);
    const token = this.jwtService.sign({
      sub: usuarioSalvo.id,
      email: usuarioSalvo.email,
    });

    await this.logsService.registrarLog({
      acao: 'Usuário Registrado',
      usuarioId: usuarioSalvo.id,
      nivel: NivelLog.INFO,
      origem: OrigemLog.BACKEND,
      detalhes: { email: usuarioSalvo.email },
    });

    return {
      token,
      usuario: {
        id: usuarioSalvo.id,
        nome: usuarioSalvo.nome,
        email: usuarioSalvo.email,
        cpf: usuarioSalvo.cpf,
      },
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const usuario = await this.usuarioRepository.findOne({
      where: { email: dto.email },
    });
    if (!usuario) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const senhaValida = await bcrypt.compare(dto.senha, usuario.senha);
    if (!senhaValida) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const token = this.jwtService.sign({
      sub: usuario.id,
      email: usuario.email,
    });

    await this.logsService.registrarLog({
      acao: 'Usuário Logou',
      usuarioId: usuario.id,
      nivel: NivelLog.INFO,
      origem: OrigemLog.BACKEND,
      detalhes: { email: usuario.email },
    });
    return {
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        cpf: usuario.cpf,
      },
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<AuthResponse> {
    const usuario = await this.usuarioRepository.findOne({ where: { id: userId } });
    if (!usuario) {
      throw new UnauthorizedException('Usuário não encontrado.');
    }

    if (dto.nome) {
      usuario.nome = dto.nome;
    }

    // Se houver tentativa de mudar email ou senha, precisa validar a senha atual
    if (dto.email || dto.novaSenha) {
      if (!dto.senhaAtual) {
        throw new UnauthorizedException('A senha atual é obrigatória para alterar e-mail ou senha.');
      }

      const senhaValida = await bcrypt.compare(dto.senhaAtual, usuario.senha);
      if (!senhaValida) {
        throw new UnauthorizedException('Senha atual incorreta.');
      }

      if (dto.email && dto.email !== usuario.email) {
        const emailExiste = await this.usuarioRepository.findOne({ where: { email: dto.email } });
        if (emailExiste) {
          throw new ConflictException('O novo e-mail já está em uso por outro usuário.');
        }
        usuario.email = dto.email;
      }

      if (dto.novaSenha) {
        const salt = await bcrypt.genSalt(10);
        usuario.senha = await bcrypt.hash(dto.novaSenha, salt);
      }
    }

    const usuarioSalvo = await this.usuarioRepository.save(usuario);

    // Gerar novo token pois o payload do token contém o email, que pode ter mudado.
    const token = this.jwtService.sign({
      sub: usuarioSalvo.id,
      email: usuarioSalvo.email,
    });

    await this.logsService.registrarLog({
      acao: 'Perfil Atualizado',
      usuarioId: usuarioSalvo.id,
      nivel: NivelLog.INFO,
      origem: OrigemLog.BACKEND,
      detalhes: { email: usuarioSalvo.email },
    });

    return {
      token,
      usuario: {
        id: usuarioSalvo.id,
        nome: usuarioSalvo.nome,
        email: usuarioSalvo.email,
        cpf: usuarioSalvo.cpf,
      },
    };
  }

  async deleteAccount(id: string): Promise<void> {
    const usuario = await this.usuarioRepository.findOne({ where: { id } });
    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    
    // Soft delete do usuário
    await this.usuarioRepository.softDelete(id);

    await this.logsService.registrarLog({
      acao: 'Conta Excluída (Soft Delete)',
      usuarioId: id,
      nivel: NivelLog.INFO,
      origem: OrigemLog.BACKEND,
      detalhes: { email: usuario.email },
    });
  }
}
