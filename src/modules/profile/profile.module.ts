import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PassportModule } from "@nestjs/passport";
import { ProfileController } from "./profile.controller";
import { ProfileService } from "./profile.service";
import { S3Service } from "../shared/s3.uploader";
import { JwtAccessStrategy } from "../shared/jwt.strategy";

@Module({
	imports: [
		PassportModule,
		JwtModule.registerAsync({
			imports: [ConfigModule],
			useFactory: (configService: ConfigService) => ({
				secret: configService.get("JWT_SECRET")
			}),
			inject: [ConfigService]
		})
	],
	controllers: [ProfileController],
	providers: [ProfileService, JwtAccessStrategy, S3Service],
	exports: [S3Service]
})
export class ProfileModule {}
