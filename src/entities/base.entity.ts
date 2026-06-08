import { PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export abstract class EntidadeBase {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ type: 'timestamp', name: 'criado_em' })
  criadoEm!: Date;
}
