import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksService } from './tasks.service';
import { Area } from '../../entities/area.entity';
import { FocoIncendio } from '../../entities/focoincendio.entity';
import { Alerta } from '../../entities/alerta.entity';
import { HistoricoSiri } from '../../entities/historicosiri.entity';
import { GeoModule } from '../geo/geo.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { SiriModule } from '../siri/siri.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Area, FocoIncendio, Alerta, HistoricoSiri]),
    GeoModule,
    IntegrationsModule,
    SiriModule,
  ],
  providers: [TasksService],
})
export class TasksModule {}
