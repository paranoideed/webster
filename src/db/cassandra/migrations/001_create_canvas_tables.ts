import { Client } from 'cassandra-driver';
import { MigrationInterface, QueryRunner } from 'typeorm';

export const name = '001_create_canvas_tables';

export async function down(client: Client): Promise<void> {
	await client.execute('DROP TABLE IF EXISTS commits');
	await client.execute('DROP TABLE IF EXISTS snapshots');
}

export async function up(client: Client): Promise<void> {
	await client.execute(`
		CREATE TABLE IF NOT EXISTS snapshots (
			canva_id   UUID,
			version    INT,
			body       TEXT,
			created_at TIMESTAMP,
			PRIMARY KEY (canva_id, version)
		) WITH CLUSTERING ORDER BY (version DESC)
	`);

	await client.execute(`
		CREATE TABLE IF NOT EXISTS commits (
			canva_id   UUID,
			number     INT,
			previous   INT,
			changes    TEXT,
			created_at TIMESTAMP,
			PRIMARY KEY (canva_id, number)
		) WITH CLUSTERING ORDER BY (number DESC)
	`);
}
