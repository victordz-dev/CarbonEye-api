import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config(); // Load environment variables from .env

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USER || 'carboneye',
  password: process.env.DATABASE_PASSWORD || 'carboneye_pass',
  database: process.env.DATABASE_NAME || 'carboneye_db',
  entities: ['src/entities/**/*.ts'],
  migrations: ['src/migrations/**/*.ts'],
  synchronize: false, // Em prod e migrations, NUNCA usar synchronize: true para não quebrar tabelas do QGIS
});
