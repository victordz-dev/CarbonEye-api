import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Usuario } from './usuario.entity';
import { EntidadeBase } from './base.entity';

export enum NivelLog {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export enum OrigemLog {
  FRONTEND = 'FRONTEND',
  BACKEND = 'BACKEND',
}

@Entity('sistema_logs')
export class SistemaLog extends EntidadeBase {
  @Column({
    type: 'enum',
    enum: NivelLog,
    default: NivelLog.INFO,
  })
  nivel!: NivelLog;

  @Column({
    type: 'enum',
    enum: OrigemLog,
    default: OrigemLog.BACKEND,
  })
  origem!: OrigemLog;

  @Column({ name: 'usuario_id', type: 'uuid', nullable: true })
  usuarioId?: string;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'usuario_id' })
  usuario?: Usuario;

  @Column({ length: 255 })
  acao!: string;

  @Column({ type: 'jsonb', nullable: true })
  detalhes?: any;
}
