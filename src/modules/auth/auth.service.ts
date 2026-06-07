import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '../../entities/usuario.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

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
}
