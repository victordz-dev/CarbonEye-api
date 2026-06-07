import { Module } from '@nestjs/common';
import { SiriService } from './siri.service';
import { GeoModule } from '../geo/geo.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [GeoModule, IntegrationsModule],
  providers: [SiriService],
  exports: [SiriService],
})
export class SiriModule {}
