import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { CanvaController } from './canva.controller';
import { CanvaService } from './canva.service';
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
	],
	controllers: [CanvaController],
	providers: [CanvaService, JwtAccessStrategy],
})
export class CanvaModule {}
