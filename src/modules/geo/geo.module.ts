import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeoService } from './geo.service';
import { TerritorioProtegido } from '../../entities/territorioprotegido.entity';
import { FocoIncendio } from '../../entities/focoincendio.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TerritorioProtegido, FocoIncendio])],
  providers: [GeoService],
  exports: [GeoService],
})
export class GeoModule {}
