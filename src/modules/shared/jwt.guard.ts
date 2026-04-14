import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtGuard extends AuthGuard('jwt-access') {}

@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}

@Injectable()
export class OptionalJwtGuard extends AuthGuard('jwt-access') {
	handleRequest(_err: any, user: any) {
		return user ?? null;
	}
}
