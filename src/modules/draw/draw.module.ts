import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { DrawGateway } from './draw.gateway';
import { DrawService } from './draw.service';
import { CassandraService } from 'src/db/cassandra/cassandra.service';

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
	providers: [DrawGateway, DrawService, CassandraService, ConfigService],
})
export class DrawModule {}
