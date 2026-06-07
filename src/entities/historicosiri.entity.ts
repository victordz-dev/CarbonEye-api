import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Area } from './area.entity';

@Entity('historicos_siri')
export class HistoricoSiri {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'area_id' })
  areaId!: string;

  @Column({ type: 'integer', name: 'nota_vegetacao' })
  notaVegetacao!: number;

  @Column({ type: 'integer', name: 'nota_historico_ndvi' })
  notaHistoricoNdvi!: number;

  @Column({ type: 'integer', name: 'nota_incendios' })
  notaIncendios!: number;

  @Column({ type: 'integer', name: 'nota_clima' })
  notaClima!: number;

  @Column({ type: 'integer', name: 'pontuacao_total' })
  pontuacaoTotal!: number;

  @Column({ type: 'varchar', length: 255, name: 'classificacao_geral' })
  classificacaoGeral!: string;

  @CreateDateColumn({ type: 'timestamp', name: 'data_calculo' })
  dataCalculo!: Date;

  @ManyToOne(() => Area, (area) => area.historicosSiri, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'area_id' })
  area!: Area;
}
