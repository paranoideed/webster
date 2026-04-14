import { Module, OnModuleInit } from "@nestjs/common";
import { ConfigModule } from '@nestjs/config';
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./modules/auth/auth.module";
import { ProfileModule } from "./modules/profile/profile.module";
import { database } from "src/db/data-source";

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true, envFilePath: [".env"] }),
		AuthModule,
		ProfileModule,
	],
	controllers: [AppController],
	providers: [AppService]
})
export class AppModule implements OnModuleInit {
	async onModuleInit() {
		await database.init();
	}
}
