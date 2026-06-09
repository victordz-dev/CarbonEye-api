import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { Area } from './area.entity';
import { EntidadeBase } from './base.entity';

@Entity('usuarios')
export class Usuario extends EntidadeBase {
  @Column({ type: 'varchar', length: 255 })
  nome!: string;

  @Column({ type: 'varchar', length: 11, unique: true })
  cpf!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  senha!: string;

  @DeleteDateColumn({ type: 'timestamp', name: 'excluido_em', nullable: true })
  excluidoEm?: Date;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'expo_push_token' })
  expoPushToken!: string | null;

  @OneToMany(() => Area, (area) => area.usuario)
  areas!: Area[];
}
