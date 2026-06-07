import {
  IsString,
  IsNotEmpty,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CoordenadaDto } from './analisar-area.dto';

export class SalvarAreaDto {
  @IsString()
  @IsNotEmpty()
  nome!: string;

  @IsArray()
  @ArrayMinSize(3, { message: 'O polígono deve conter pelo menos 3 pontos.' })
  @ValidateNested({ each: true })
  @Type(() => CoordenadaDto)
  poligono!: CoordenadaDto[];

  @IsBoolean()
  monitoramento_ativo!: boolean;

  @IsNumber()
  siri_inicial!: number;
}
