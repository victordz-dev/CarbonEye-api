import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Area } from './area.entity';

@Entity('alertas')
export class Alerta {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'area_id' })
  areaId!: string;

  @Column({ type: 'varchar', length: 50 })
  tipo!: string;

  @Column({ type: 'text' })
  mensagem!: string;

  @Column({ type: 'boolean', default: false })
  lida!: boolean;

  @CreateDateColumn({ type: 'timestamp', name: 'data_evento' })
  dataEvento!: Date;

  @ManyToOne(() => Area, (area) => area.alertas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'area_id' })
  area!: Area;
}
