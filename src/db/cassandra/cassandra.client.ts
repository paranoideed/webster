import { Client } from 'cassandra-driver';

class CassandraDatabase {
	private _client: Client | null = null;

	get client(): Client {
		if (!this._client) throw new Error('Cassandra client not initialized. Call init() first.');
		return this._client;
	}

	async init() {
		const keyspace = process.env.CASSANDRA_KEYSPACE ?? 'webster';

		this._client = new Client({
			contactPoints: (process.env.CASSANDRA_CONTACT_POINTS ?? 'localhost').split(','),
			localDataCenter: process.env.CASSANDRA_LOCAL_DC ?? 'dc1',
			keyspace,
		});

		await this._client.connect();
	}

	async shutdown() {
		await this._client?.shutdown();
	}
}

export const cassandraDatabase = new CassandraDatabase();
