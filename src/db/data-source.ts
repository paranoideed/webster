import { DataSource } from "typeorm";

class Database {
	dataSource: DataSource;

	getDataSource() {
		this.dataSource = new DataSource({
			type: "postgres",
			host: process.env.DB_HOST,
			port: Number(process.env.DB_PORT),
			username: process.env.DB_USERNAME,
			password: process.env.DB_PASSWORD,
			database: process.env.DB_NAME,
			entities: [`${__dirname}/entity/*{.js,.ts}`],
			migrations: [`${__dirname}/migrations/*{.js,.ts}`],
			migrationsTableName: "migrations"
		});
		return this.dataSource;
	}

	async init() {
		this.getDataSource();
		await this.dataSource.initialize();
	}
}

export const database = new Database();
export default database.getDataSource();
