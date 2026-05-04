import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { MulterModule } from '@nestjs/platform-express';
import { ImageController } from './image.controller';
import { ImageService } from './image.service';
import { S3Service } from '../shared/s3.uploader';
import { JwtAccessStrategy } from '../shared/jwt.strategy';

@Module({
	imports: [
		PassportModule,
		JwtModule.registerAsync({
			imports: [ConfigModule],
			useFactory: (configService: ConfigService) => ({
				secret: configService.get('JWT_SECRET'),
			}),
			inject: [ConfigService],
		}),
		MulterModule.register({
			limits: { fileSize: 10 * 1024 * 1024 },
		}),
	],
	controllers: [ImageController],
	providers: [ImageService, S3Service, JwtAccessStrategy],
})
export class ImageModule {}
