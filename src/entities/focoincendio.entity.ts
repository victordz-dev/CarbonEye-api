import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import type { Point } from 'geojson';

@Entity('focos_incendio')
export class FocoIncendio {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ spatial: true })
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  geometria!: Point;

  @Column({ type: 'timestamp' })
  data!: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  satelite!: string | null;

  @Column({ type: 'integer', nullable: true })
  confianca!: number | null;
}
