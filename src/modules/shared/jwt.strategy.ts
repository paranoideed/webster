import { ExtractJwt, JwtFromRequestFunction, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

export type AccessTokenPayload = {
	sub: string;
	role: string;
};

export type RefreshTokenPayload = {
	sub: string;
};

export const extractAccessToken: JwtFromRequestFunction = (req: Request) => {
	return req.cookies['access'];
};

export const extractRefreshToken: JwtFromRequestFunction = (req: Request) => {
	return req.cookies['refresh'];
};

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(
	Strategy,
	'jwt-access',
) {
	constructor() {
		super({
			jwtFromRequest: ExtractJwt.fromExtractors([extractAccessToken]),
			ignoreExpiration: false,
			secretOrKey: String(process.env.JWT_SECRET),
		});
	}

	validate(payload: AccessTokenPayload) {
		return { id: payload.sub, role: payload.role }; // req.user
	}
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
	Strategy,
	'jwt-refresh',
) {
	constructor() {
		super({
			jwtFromRequest: ExtractJwt.fromExtractors([extractRefreshToken]),
			ignoreExpiration: false,
			secretOrKey: String(process.env.JWT_SECRET),
		});
	}

	validate(payload: RefreshTokenPayload) {
		return { id: payload.sub }; // req.user
	}
}
