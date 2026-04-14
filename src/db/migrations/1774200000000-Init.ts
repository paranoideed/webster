import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1774200000000 implements MigrationInterface {
	name = "Init1774200000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		// ENUMs
		await queryRunner.query(
			`CREATE TYPE "public"."account_roles" AS ENUM('admin', 'user')`
		);

		// Tables
		await queryRunner.query(
			`CREATE TABLE "accounts" (
				"id"         uuid NOT NULL DEFAULT uuid_generate_v4(),
				"email"      character varying(256) NOT NULL,
				"verified"   boolean NOT NULL DEFAULT false,
				"role"       "public"."account_roles" NOT NULL DEFAULT 'user',
				"password"   character varying(256),
				"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				"deleted_at" TIMESTAMP WITH TIME ZONE,
				CONSTRAINT "UQ_accounts_email" UNIQUE ("email"),
				CONSTRAINT "PK_accounts" PRIMARY KEY ("id")
			)`
		);
		await queryRunner.query(
			`CREATE TABLE "profiles" (
				"account_id"  uuid NOT NULL,
				"username"    character varying(30) NOT NULL,
				"visibility"  boolean NOT NULL DEFAULT true,
				"avatar_key"  character varying(255),
				"created_at"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				"updated_at"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				"deleted_at"  TIMESTAMP WITH TIME ZONE,
				CONSTRAINT "UQ_profiles_username" UNIQUE ("username"),
				CONSTRAINT "PK_profiles" PRIMARY KEY ("account_id")
			)`
		);
		await queryRunner.query(
			`CREATE TABLE "email_verifications" (
				"id"         uuid NOT NULL DEFAULT uuid_generate_v4(),
				"email"      character varying(256) NOT NULL,
				"code"       character varying(256) NOT NULL,
				"expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
				"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				CONSTRAINT "UQ_email_verifications_code" UNIQUE ("code"),
				CONSTRAINT "PK_email_verifications" PRIMARY KEY ("id")
			)`
		);

		// Foreign keys
		await queryRunner.query(
			`ALTER TABLE "profiles" ADD CONSTRAINT "FK_profiles_account_id"
			 FOREIGN KEY ("account_id") REFERENCES "accounts"("id")
			 ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE`
		);
		await queryRunner.query(
			`ALTER TABLE "email_verifications" ADD CONSTRAINT "FK_email_verifications_email"
			 FOREIGN KEY ("email") REFERENCES "accounts"("email")
			 ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "email_verifications" DROP CONSTRAINT "FK_email_verifications_email"`);
		await queryRunner.query(`ALTER TABLE "profiles" DROP CONSTRAINT "FK_profiles_account_id"`);
		await queryRunner.query(`DROP TABLE "email_verifications"`);
		await queryRunner.query(`DROP TABLE "profiles"`);
		await queryRunner.query(`DROP TABLE "accounts"`);
		await queryRunner.query(`DROP TYPE "public"."account_roles"`);
	}
}
