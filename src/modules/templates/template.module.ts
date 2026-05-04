import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PassportModule } from "@nestjs/passport";
import { TemplateController } from "./template.controller";
import { TemplateService } from "./template.service";
import { JwtAccessStrategy } from "../shared/jwt.strategy";

@Module({
	imports: [
		PassportModule,
		JwtModule.registerAsync({
			imports: [ConfigModule],
			useFactory: (configService: ConfigService) => ({
				secret: configService.get("JWT_SECRET"),
			}),
			inject: [ConfigService],
		}),
	],
	controllers: [TemplateController],
	providers: [TemplateService, JwtAccessStrategy],
})
export class TemplateModule {}
