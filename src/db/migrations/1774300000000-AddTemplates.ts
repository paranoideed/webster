import { MigrationInterface, QueryRunner } from "typeorm";

const BLANK_BODY = JSON.stringify({
	attrs: { width: 1920, height: 1080 },
	className: "Stage",
	children: [{ attrs: {}, className: "Layer", children: [] }],
});

const BLANK_WIDE_BODY = JSON.stringify({
	attrs: { width: 1280, height: 720 },
	className: "Stage",
	children: [{ attrs: {}, className: "Layer", children: [] }],
});

const BLANK_SQUARE_BODY = JSON.stringify({
	attrs: { width: 1080, height: 1080 },
	className: "Stage",
	children: [{ attrs: {}, className: "Layer", children: [] }],
});

export class AddTemplates1774300000000 implements MigrationInterface {
	name = "AddTemplates1774300000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "templates" (
				"id"          uuid NOT NULL DEFAULT uuid_generate_v4(),
				"account_id"  uuid,
				"name"        character varying(255) NOT NULL,
				"body"        jsonb NOT NULL,
				"public"      boolean NOT NULL DEFAULT false,
				"created_at"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				"deleted_at"  TIMESTAMP WITH TIME ZONE,
				CONSTRAINT "PK_templates" PRIMARY KEY ("id"),
				CONSTRAINT "CHK_templates_public_no_account"
					CHECK (NOT ("public" = true AND "account_id" IS NOT NULL))
			)`,
		);

		await queryRunner.query(
			`ALTER TABLE "templates" ADD CONSTRAINT "FK_templates_account_id"
			 FOREIGN KEY ("account_id") REFERENCES "accounts"("id")
			 ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE`,
		);

		// Seed public templates
		await queryRunner.query(
			`INSERT INTO "templates" ("name", "body", "public") VALUES
				('Blank (1920×1080)', $1, true),
				('Blank (1280×720)',  $2, true),
				('Blank (1080×1080)', $3, true)`,
			[BLANK_BODY, BLANK_WIDE_BODY, BLANK_SQUARE_BODY],
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "templates" DROP CONSTRAINT "FK_templates_account_id"`,
		);
		await queryRunner.query(`DROP TABLE "templates"`);
	}
}
