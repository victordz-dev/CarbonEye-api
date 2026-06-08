import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { Polygon, MultiPolygon } from 'geojson';

@Entity('territorios_protegidos')
export class TerritorioProtegido {
  @PrimaryGeneratedColumn('increment', { type: 'integer', name: 'gid' })
  gid!: number;

  @Column({ type: 'varchar', length: 255, name: 'nome_reserva' })
  nomeReserva!: string;

  @Column({ type: 'varchar', length: 50 })
  tipo!: string;

  @Index({ spatial: true })
  @Column({
    type: 'geometry',
    name: 'geom',
    spatialFeatureType: 'Geometry',
    srid: 4326,
  })
  geom!: Polygon | MultiPolygon;
}
