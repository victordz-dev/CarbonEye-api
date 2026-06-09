import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1780975436205 implements MigrationInterface {
    name = 'Migration1780975436205'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuarios" ADD "expo_push_token" character varying(255)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuarios" DROP COLUMN "expo_push_token"`);
    }

}
