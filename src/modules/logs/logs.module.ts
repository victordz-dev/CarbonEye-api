import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogsService } from './logs.service';
import { LogsController } from './logs.controller';
import { SistemaLog } from '../../entities/sistemalog.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SistemaLog])],
  controllers: [LogsController],
  providers: [LogsService],
  exports: [LogsService],
})
export class LogsModule {}
