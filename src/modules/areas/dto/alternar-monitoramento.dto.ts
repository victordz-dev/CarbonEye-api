import { IsBoolean } from 'class-validator';

export class AlternarMonitoramentoDto {
  @IsBoolean()
  monitoramento_ativo!: boolean;
}
