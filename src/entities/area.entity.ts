import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Usuario } from './usuario.entity';
import { HistoricoSiri } from './historicosiri.entity';
import { Alerta } from './alerta.entity';
import type { Polygon } from 'geojson';
import { EntidadeBase } from './base.entity';
import { HistoricoAreaResponse } from '../modules/areas/areas.interfaces';

@Entity('areas')
export class Area extends EntidadeBase {
  @Column({ type: 'uuid', name: 'usuario_id' })
  usuarioId!: string;

  @Column({ type: 'varchar', length: 255 })
  nome!: string;

  @Column({
    type: 'geometry',
    spatialFeatureType: 'Polygon',
    srid: 4326,
  })
  geometria!: Polygon;

  @Column({ type: 'varchar', length: 50, default: 'NORMAL' })
  status!: string;

  @Column({ type: 'integer', name: 'siri_atual', nullable: true })
  siriAtual!: number | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'classificacao_atual',
    nullable: true,
  })
  classificacaoAtual!: string | null;

  @Column({ type: 'timestamp', name: 'ultima_analise', nullable: true })
  ultimaAnalise!: Date | null;

  @Column({ type: 'boolean', name: 'monitoramento_ativo', default: false })
  monitoramentoAtivo!: boolean;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'agro_polygon_id',
    nullable: true,
  })
  agroPolygonId!: string | null;

  @Column({ type: 'jsonb', name: 'snapshot_detalhes', nullable: true })
  snapshotDetalhes!: HistoricoAreaResponse | null;

  @ManyToOne(() => Usuario, (usuario) => usuario.areas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: Usuario;

  @OneToMany(() => HistoricoSiri, (historico) => historico.area)
  historicosSiri!: HistoricoSiri[];

  @OneToMany(() => Alerta, (alerta) => alerta.area)
  alertas!: Alerta[];
}
