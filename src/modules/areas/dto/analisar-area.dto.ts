import {
  IsNumber,
  IsNotEmpty,
  IsArray,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CoordenadaDto {
  @IsNumber()
  @IsNotEmpty()
  latitude!: number;

  @IsNumber()
  @IsNotEmpty()
  longitude!: number;
}

export class AnalisarAreaDto {
  @IsArray()
  @ArrayMinSize(3, { message: 'O polígono deve conter pelo menos 3 pontos.' })
  @ValidateNested({ each: true })
  @Type(() => CoordenadaDto)
  poligono!: CoordenadaDto[];
}
