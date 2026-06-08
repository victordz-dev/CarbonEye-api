import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alerta } from '../../entities/alerta.entity';
import { Area } from '../../entities/area.entity';
import { AlertasService } from './alertas.service';
import { AlertasController } from './alertas.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Alerta, Area])],
  controllers: [AlertasController],
  providers: [AlertasService],
})
export class AlertasModule {}
