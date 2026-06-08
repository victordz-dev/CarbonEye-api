import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Area } from './area.entity';
import { EntidadeBase } from './base.entity';

@Entity('alertas')
export class Alerta extends EntidadeBase {
  @Column({ type: 'uuid', name: 'area_id' })
  areaId!: string;

  @Column({ type: 'varchar', length: 50 })
  tipo!: string;

  @Column({ type: 'text' })
  mensagem!: string;

  @Column({ type: 'boolean', default: false })
  lida!: boolean;

  @ManyToOne(() => Area, (area) => area.alertas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'area_id' })
  area!: Area;
}
