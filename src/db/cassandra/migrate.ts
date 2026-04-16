import 'dotenv/config';
import { runMigrations, revertLastMigration } from './cassandra.migrator';

const isDown = process.argv.includes('--down');

const task = isDown ? revertLastMigration() : runMigrations();

task.catch((err) => {
	console.error('[Cassandra] Migration failed:', err);
	process.exit(1);
});
