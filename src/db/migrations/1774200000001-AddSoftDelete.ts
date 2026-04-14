import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSoftDelete1774200000001 implements MigrationInterface {
	name = "AddSoftDelete1774200000001";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "projects" ADD COLUMN "deleted_at" TIMESTAMP WITH TIME ZONE`,
		);
		await queryRunner.query(
			`ALTER TABLE "project_members" ADD COLUMN "deleted_at" TIMESTAMP WITH TIME ZONE`,
		);

		// Replace the hard unique constraint with a partial index so that
		// soft-deleted rows don't block re-adding the same member.
		await queryRunner.query(
			`ALTER TABLE "project_members" DROP CONSTRAINT "UQ_project_members_account_project"`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_project_members_account_project_active"
			 ON "project_members" ("account_id", "project_id")
			 WHERE "deleted_at" IS NULL`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`DROP INDEX "UQ_project_members_account_project_active"`,
		);
		await queryRunner.query(
			`ALTER TABLE "project_members"
			 ADD CONSTRAINT "UQ_project_members_account_project"
			 UNIQUE ("account_id", "project_id")`,
		);
		await queryRunner.query(
			`ALTER TABLE "project_members" DROP COLUMN "deleted_at"`,
		);
		await queryRunner.query(
			`ALTER TABLE "projects" DROP COLUMN "deleted_at"`,
		);
	}
}
