import { BadRequestException } from '@nestjs/common';

export class CoordenadaVO {
  constructor(
    public readonly latitude: number,
    public readonly longitude: number,
  ) {
    this.validar();
  }

  private validar(): void {
    if (this.latitude < -90 || this.latitude > 90) {
      throw new BadRequestException(
        'A latitude deve estar entre -90 e 90 graus.',
      );
    }
    if (this.longitude < -180 || this.longitude > 180) {
      throw new BadRequestException(
        'A longitude deve estar entre -180 e 180 graus.',
      );
    }
  }

  public toArray(): [number, number] {
    return [this.longitude, this.latitude]; // Formato [lon, lat] usado pelo PostGIS/GeoJSON
  }

  public toDto(): { latitude: number; longitude: number } {
    return { latitude: this.latitude, longitude: this.longitude };
  }

  public toString(): string {
    return `[${this.latitude}, ${this.longitude}]`;
  }
}
