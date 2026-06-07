import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AreasService } from './areas.service';
import { AreasController } from './areas.controller';
import { Area } from '../../entities/area.entity';
import { HistoricoSiri } from '../../entities/historicosiri.entity';
import { Alerta } from '../../entities/alerta.entity';
import { GeoModule } from '../geo/geo.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { SiriModule } from '../siri/siri.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Area, HistoricoSiri, Alerta]),
    GeoModule,
    IntegrationsModule,
    SiriModule,
  ],
  controllers: [AreasController],
  providers: [AreasService],
  exports: [AreasService],
})
export class AreasModule {}
