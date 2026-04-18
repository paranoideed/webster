import { Client } from 'cassandra-driver';
import * as path from 'path';
import * as fs from 'fs';

const KEYSPACE_REPLICATION = `{ 'class': 'SimpleStrategy', 'replication_factor': '1' }`;

async function createKeyspace(client: Client, keyspace: string) {
	await client.execute(
		`CREATE KEYSPACE IF NOT EXISTS ${keyspace} WITH replication = ${KEYSPACE_REPLICATION}`
	);
}

async function createMigrationsTable(client: Client) {
	await client.execute(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			name       TEXT PRIMARY KEY,
			applied_at TIMESTAMP
		)
	`);
}

async function getAppliedMigrations(client: Client): Promise<Set<string>> {
	const result = await client.execute('SELECT name FROM schema_migrations');
	return new Set(result.rows.map((row) => row.name as string));
}

async function recordMigration(client: Client, name: string) {
	await client.execute(
		'INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)',
		[name, new Date()],
		{ prepare: true }
	);
}

async function deleteMigrationRecord(client: Client, name: string) {
	await client.execute(
		'DELETE FROM schema_migrations WHERE name = ?',
		[name],
		{ prepare: true }
	);
}

export async function runMigrations() {
	const keyspace = process.env.CASSANDRA_KEYSPACE ?? 'webster';
	const contactPoints = (process.env.CASSANDRA_CONTACT_POINTS ?? 'localhost').split(',');
	const localDataCenter = process.env.CASSANDRA_LOCAL_DC ?? 'dc1';

	// Connect without keyspace to create it
	const bootstrapClient = new Client({ contactPoints, localDataCenter });
	await bootstrapClient.connect();

	console.log(`[Cassandra] Creating keyspace "${keyspace}" if not exists...`);
	await createKeyspace(bootstrapClient, keyspace);
	await bootstrapClient.shutdown();

	// Connect with keyspace
	const client = new Client({ contactPoints, localDataCenter, keyspace });
	await client.connect();

	await createMigrationsTable(client);

	const applied = await getAppliedMigrations(client);

	const migrationsDir = path.join(__dirname, 'migrations');
	const files = fs
		.readdirSync(migrationsDir)
		.filter((f) => (f.endsWith('.ts') && !f.endsWith('.d.ts')) || f.endsWith('.js'))
		.sort();

	for (const file of files) {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const migration = require(path.join(migrationsDir, file));
		const migrationName: string = migration.name;

		if (applied.has(migrationName)) {
			console.log(`[Cassandra] Skip: ${migrationName}`);
			continue;
		}

		console.log(`[Cassandra] Running: ${migrationName}`);
		await migration.up(client);
		await recordMigration(client, migrationName);
		console.log(`[Cassandra] Done: ${migrationName}`);
	}

	await client.shutdown();
	console.log('[Cassandra] Migrations complete.');
}

export async function revertLastMigration() {
	const keyspace = process.env.CASSANDRA_KEYSPACE ?? 'webster';
	const contactPoints = (process.env.CASSANDRA_CONTACT_POINTS ?? 'localhost').split(',');
	const localDataCenter = process.env.CASSANDRA_LOCAL_DC ?? 'dc1';

	const client = new Client({ contactPoints, localDataCenter, keyspace });
	await client.connect();

	const applied = await getAppliedMigrations(client);
	if (applied.size === 0) {
		console.log('[Cassandra] Nothing to revert.');
		await client.shutdown();
		return;
	}

	const migrationsDir = path.join(__dirname, 'migrations');
	const files = fs
		.readdirSync(migrationsDir)
		.filter((f) => (f.endsWith('.ts') && !f.endsWith('.d.ts')) || f.endsWith('.js'))
		.sort()
		.reverse();

	for (const file of files) {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const migration = require(path.join(migrationsDir, file));
		const migrationName: string = migration.name;

		if (!applied.has(migrationName)) continue;

		console.log(`[Cassandra] Reverting: ${migrationName}`);
		await migration.down(client);
		await deleteMigrationRecord(client, migrationName);
		console.log(`[Cassandra] Reverted: ${migrationName}`);
		break; // revert only the last one
	}

	await client.shutdown();
}
