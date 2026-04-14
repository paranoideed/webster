import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PassportModule } from "@nestjs/passport";
import { ProjectController } from "./project.controller";
import { MemberController } from "./member.controller";
import { ProjectService } from "./project.service";
import { JwtAccessStrategy } from "../shared/jwt.strategy";
import { MailModule } from "../mail/mail.module";

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
		MailModule,
	],
	controllers: [ProjectController, MemberController],
	providers: [ProjectService, JwtAccessStrategy],
})
export class ProjectModule {}
