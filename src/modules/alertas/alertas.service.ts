import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alerta } from '../../entities/alerta.entity';
import { Area } from '../../entities/area.entity';

@Injectable()
export class AlertasService {
  constructor(
    @InjectRepository(Alerta)
    private readonly alertaRepository: Repository<Alerta>,
    @InjectRepository(Area)
    private readonly areaRepository: Repository<Area>,
  ) {}

  async obterAlertas(usuarioId: string): Promise<Alerta[]> {
    return this.alertaRepository.find({
      where: { area: { usuarioId } },
      relations: ['area'],
      order: { criadoEm: 'DESC' },
    });
  }

  async marcarComoLida(usuarioId: string, alertaId: string): Promise<{ mensagem: string }> {
    const alerta = await this.alertaRepository.findOne({
      where: { id: alertaId },
      relations: ['area'],
    });

    if (!alerta) {
      throw new NotFoundException('Alerta não encontrado.');
    }

    if (alerta.area.usuarioId !== usuarioId) {
      throw new UnauthorizedException('Você não tem permissão para alterar este alerta.');
    }

    alerta.lida = true;
    await this.alertaRepository.save(alerta);

    return { mensagem: 'Alerta marcado como lido.' };
  }

  async excluirAlerta(usuarioId: string, alertaId: string): Promise<{ mensagem: string }> {
    const alerta = await this.alertaRepository.findOne({
      where: { id: alertaId },
      relations: ['area'],
    });

    if (!alerta) {
      throw new NotFoundException('Alerta não encontrado.');
    }

    if (alerta.area.usuarioId !== usuarioId) {
      throw new UnauthorizedException('Você não tem permissão para excluir este alerta.');
    }

    await this.alertaRepository.remove(alerta);

    return { mensagem: 'Alerta excluído com sucesso.' };
  }
}
