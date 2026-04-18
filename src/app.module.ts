import { Module, OnModuleInit } from "@nestjs/common";
import { ConfigModule } from '@nestjs/config';
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./modules/auth/auth.module";
import { ProfileModule } from "./modules/profile/profile.module";
import { ProjectModule } from "./modules/project/project.module";
import { CanvaModule } from "./modules/canva/canva.module";
import { DrawModule } from "./modules/draw/draw.module";
import { database } from "src/db/data-source";
import { cassandraDatabase } from "src/db/cassandra/cassandra.client";

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true, envFilePath: [".env"] }),
		AuthModule,
		ProfileModule,
		ProjectModule,
		CanvaModule,
		DrawModule,
	],
	controllers: [AppController],
	providers: [AppService]
})
export class AppModule implements OnModuleInit {
	async onModuleInit() {
		await database.init();
		await cassandraDatabase.init();
	}
}
