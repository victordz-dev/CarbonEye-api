import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Usuario } from './entities/usuario.entity';
import { Area } from './entities/area.entity';
import { HistoricoSiri } from './entities/historicosiri.entity';
import { Alerta } from './entities/alerta.entity';
import { TerritorioProtegido } from './entities/territorioprotegido.entity';
import { FocoIncendio } from './entities/focoincendio.entity';
import { SistemaLog } from './entities/sistemalog.entity';
import { GeoModule } from './modules/geo/geo.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { SiriModule } from './modules/siri/siri.module';
import { AuthModule } from './modules/auth/auth.module';
import { AreasModule } from './modules/areas/areas.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { LogsModule } from './modules/logs/logs.module';
import { AlertasModule } from './modules/alertas/alertas.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const env = configService.get<string>('NODE_ENV', 'dev');
        const isProd = env === 'prod' || env === 'production';

        return {
          type: 'postgres',
          host: isProd
            ? configService.get<string>('DATABASE_HOST')
            : 'localhost',
          port: isProd
            ? configService.get<number>('DATABASE_PORT', 5432)
            : 5432,
          username: isProd
            ? configService.get<string>('DATABASE_USER')
            : 'carboneye',
          password: isProd
            ? configService.get<string>('DATABASE_PASSWORD')
            : 'carboneye_pass',
          database: isProd
            ? configService.get<string>('DATABASE_NAME')
            : 'carboneye_db',
          entities: [
            Usuario,
            Area,
            HistoricoSiri,
            Alerta,
            TerritorioProtegido,
            FocoIncendio,
            SistemaLog,
          ],
          synchronize: true, // Apenas para fins acadêmicos / dev local
        };
      },
    }),
    GeoModule,
    IntegrationsModule,
    SiriModule,
    AuthModule,
    AreasModule,
    TasksModule,
    LogsModule,
    AlertasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
