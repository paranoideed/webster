import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImages1774400000000 implements MigrationInterface {
	name = 'AddImages1774400000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "images" (
				"id"          uuid NOT NULL DEFAULT uuid_generate_v4(),
				"account_id"  uuid,
				"name"        character varying(255) NOT NULL,
				"s3_key"      character varying(512) NOT NULL,
				"mime_type"   character varying(100) NOT NULL,
				"public"      boolean NOT NULL DEFAULT false,
				"created_at"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				"deleted_at"  TIMESTAMP WITH TIME ZONE,
				CONSTRAINT "PK_images" PRIMARY KEY ("id"),
				CONSTRAINT "CHK_images_public_no_account"
					CHECK (NOT ("public" = true AND "account_id" IS NOT NULL))
			)`,
		);

		await queryRunner.query(
			`ALTER TABLE "images" ADD CONSTRAINT "FK_images_account_id"
			 FOREIGN KEY ("account_id") REFERENCES "accounts"("id")
			 ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "images" DROP CONSTRAINT "FK_images_account_id"`);
		await queryRunner.query(`DROP TABLE "images"`);
	}
}
