import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	UnauthorizedException
} from "@nestjs/common";
import { randomInt } from "crypto";
import { MoreThan } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import { database } from "src/db/data-source";
import {
	LoginDto,
	RegisterAttributes,
	CreateAccountAttributes
} from "./auth.dto";
import { GoogleIdTokenPayload, type TokenPair } from "./auth.types";
import { Account } from "src/db/entity/account.entity";
import { EmailVerification } from "src/db/entity/email-verification.entity";
import { Profile } from "src/db/entity/profile.entity";
import { Hasher } from "./hasher";
import { GoogleOAuth } from "./google.oauth";
import { S3Service } from "../shared/s3.uploader";
import { MailService } from "../mail/mail.service";

@Injectable()
export class AuthService {
	constructor(
		private jwtService: JwtService,
		private oauth: GoogleOAuth,
		private s3: S3Service,
		private mail: MailService
	) {}

	public async deleteAccount(accountId: string) {
		const [account, profile] = await Promise.all([
			Account.findOneBy({ id: accountId }),
			Profile.findOneBy({ accountId }),
		]);
		if (!account) {
			throw new ForbiddenException("Account not found");
		}
		await database.dataSource.transaction(async (manager) => {
			if (profile) await manager.softRemove(Profile, profile);
			await manager.softRemove(Account, account);
		});
	}

	public async register(dto: RegisterAttributes) {
		const existingEmail = await Account.findOneBy({
			email: dto.email
		});
		if (existingEmail) {
			throw new ConflictException(
				"Account with this email already exists"
			);
		}
		const existingUsername = await Profile.findOneBy({
			username: dto.username
		});
		if (existingUsername) {
			throw new ConflictException(
				"Account with this username already exists"
			);
		}
		const hashResult = await Hasher.hash(dto.password);
		dto.password = `${hashResult.salt}$${hashResult.hash}$${hashResult.keylen}`;
		const account = await this.createAccount(dto);
		void this.mail.welcomeEmail(account.id);
	}

	public async login(dto: LoginDto) {
		const account = await this.validateUser(dto);
		if (account) {
			void this.mail.loginNotification(account.id);
			return {
				account: account,
				access: await this.generateJwt(
					{ sub: account.id, role: account.role },
					Date.now() + Number(process.env.JWT_ACCESS_TTL_SEC ?? 300) * 1000
				),
				refresh: await this.generateJwt(
					{ sub: account.id },
					Date.now() + Number(process.env.JWT_REFRESH_TTL_SEC ?? 900) * 1000
				)
			};
		}
	}

	public async loginWithGoogle(code: string) {
		const creds = await this.oauth.authenticate(code);
		let account: Account | null;

		if (creds.id_token != null) {
			const payload = this.jwtService.decode<GoogleIdTokenPayload>(
				creds.id_token
			);
			account = await database.dataSource.manager.findOneBy(Account, {
				email: payload.email
			});
			if (account === null) {
				const response = await fetch(payload.picture)
				const buffer = Buffer.from(await response.arrayBuffer());
				const key = `user/${payload.email}/avatar_${Date.now()}`
				this.s3.putObject(buffer, response.headers.get("Content-Type")!, key)
				account = await this.createAccount({
					email: payload.email,
					username: `${payload.given_name}${payload.family_name}`,
					avatarKey: key
				});
				void this.mail.welcomeEmail(account.id);
			} else {
				void this.mail.loginNotification(account.id);
			}
		} else {
			throw new UnauthorizedException("Google authentication failed");
		}

		return {
			account: account,
			access: await this.generateJwt(
				{ sub: account.id, role: account.role },
				Date.now() + Number(process.env.JWT_ACCESS_TTL_SEC ?? 300) * 1000
			),
			refresh: await this.generateJwt(
				{ sub: account.id },
				Date.now() + Number(process.env.JWT_REFRESH_TTL_SEC ?? 900) * 1000
			)
		};
	}

	public generateGoogleAuthUrl() {
		return this.oauth.generateAuthUrl();
	}

	public async refresh(accountId: string): Promise<TokenPair> {
		const account = await Account.findOneBy({ id: accountId });
		if (!account) {
			throw new UnauthorizedException("Account not found");
		}
		return {
			access: await this.generateJwt(
				{ sub: account.id, role: account.role },
				Date.now() + Number(process.env.JWT_ACCESS_TTL_SEC ?? 300) * 1000
			),
			refresh: await this.generateJwt(
				{ sub: account.id },
				Date.now() + Number(process.env.JWT_REFRESH_TTL_SEC ?? 900) * 1000
			)
		};
	}

	//add this
	public async getMe(accountId: string): Promise<Account> {
		const account = await Account.findOneBy({ id: accountId });
		if (!account) {
			throw new UnauthorizedException("Account not found");
		}
		return account;
	}

	public async requestEmailVerification(accountId: string): Promise<void> {
		const account = await Account.findOneBy({ id: accountId });
		if (!account) {
			throw new UnauthorizedException("Account not found");
		}
		if (account.verified) {
			throw new BadRequestException("Email is already verified");
		}

		const code = randomInt(100000, 999999).toString();
		const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

		const verification = EmailVerification.create({
			accountId,
			code,
			expiresAt
		});
		await verification.save();

		void this.mail.sendVerificationCode(accountId, code);
	}

	public async confirmEmailVerification(accountId: string, code: string): Promise<void> {
		const account = await Account.findOneBy({ id: accountId });
		if (!account) {
			throw new UnauthorizedException("Account not found");
		}
		if (account.verified) {
			throw new BadRequestException("Email is already verified");
		}

		const verification = await EmailVerification.findOne({
			where: {
				accountId,
				code,
				expiresAt: MoreThan(new Date())
			}
		});
		if (!verification) {
			void this.mail.emailVerificationFailed(accountId);
			throw new BadRequestException("Invalid or expired verification code");
		}

		account.verified = true;
		await account.save();
		await verification.remove();
		void this.mail.emailVerificationSuccess(accountId);
	}

	private async validateUser(dto: LoginDto) {
		const account = await database.dataSource.manager.findOneBy(Account, {
			email: dto.data.attributes.email
		});
		if (!account || !account.password) {
			return null;
		}

		const isCorrect = await Hasher.compare(
			dto.data.attributes.password,
			account.password
		);

		return isCorrect ? account : null;
	}

	private async createAccount(dto: CreateAccountAttributes) {
		const queryRunner = database.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			const account = queryRunner.manager.create(Account, {
				...dto
			});
			await queryRunner.manager.save(account);
			const profile = queryRunner.manager.create(Profile, {
				...dto,
				account: account
			});
			await queryRunner.manager.save(profile);
			await queryRunner.commitTransaction();
			return account;
		} catch (e) {
			await queryRunner.rollbackTransaction();
			throw e;
		} finally {
			await queryRunner.release();
		}
	}

	private async generateJwt(payload, expires: number) {
		return {
			token: await this.jwtService.signAsync(payload, {
				expiresIn: Math.floor((expires - Date.now()) / 1000)
			}),
			expires: expires
		};
	}
}
