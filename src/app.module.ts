import { Module, OnModuleInit } from "@nestjs/common";
import { ConfigModule } from '@nestjs/config';
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./modules/auth/auth.module";
import { ProfileModule } from "./modules/profile/profile.module";
import { ProjectModule } from "./modules/project/project.module";
import { CanvaModule } from "./modules/canva/canva.module";
import { database } from "src/db/data-source";
import { cassandraDatabase } from "src/db/cassandra/cassandra.client";
import { runMigrations } from "src/db/cassandra/cassandra.migrator";

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true, envFilePath: [".env"] }),
		AuthModule,
		ProfileModule,
		ProjectModule,
		CanvaModule,
	],
	controllers: [AppController],
	providers: [AppService]
})
export class AppModule implements OnModuleInit {
	async onModuleInit() {
		await database.init();
		await runMigrations();
		await cassandraDatabase.init();
	}
}
