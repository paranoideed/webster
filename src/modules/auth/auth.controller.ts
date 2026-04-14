import {
	Body,
	Controller,
	Delete,
	Post,
	Res,
	HttpStatus,
	HttpCode,
	UseGuards,
	Get,
	Query
} from "@nestjs/common";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { RegisterDto, LoginDto, VerifyEmailConfirmDto } from "./auth.dto";
import type { TokenPair } from "./auth.types";
import { JwtGuard, JwtRefreshGuard } from "../shared/jwt.guard";
import { accountResponse } from "./auth.response";
import { CurrentUser } from "../shared/decorators";
import { AppLogger } from "../shared/logger";

// i think /accounts its better than /account because we must decide
// use always xxxs or xxx so i think we already decide xxxs
// and i think 95% project use xxxs
@Controller("accounts")
export class AuthController {
	private readonly log = new AppLogger(AuthController.name);

	constructor(private authService: AuthService) {}

	@UseGuards(JwtGuard)
	@Get("me")
	async getMe(@CurrentUser() user: Express.User, @Res() res: Response) {
		const account = await this.authService.getMe(user.id);
		res.json(accountResponse(account));
	}

	@Post("registration")
	async register(@Body() dto: RegisterDto) {
		await this.authService.register({ ...dto.data.attributes });
		this.log.info("POST", "/account/registration", 201);
	}

	@Post("login")
	@HttpCode(HttpStatus.OK)
	async login(@Body() dto: LoginDto, @Res() res: Response) {
		//so honestly dosent metter does user already have tokens or not
		//and btw vpadly while testing use /logout /login and do again and again so I decided clean cookies here
		res.clearCookie("access");
		res.clearCookie("refresh");

		const result = await this.authService.login(dto);
		if (result) {
			this.setTokenPair(res, result);
			this.log.info("POST", "/account/login", 200);

			res.json(accountResponse(result.account));
			return;
		}

		this.log.warn("POST", "/account/login", 400, "Invalid credentials");

		res.status(HttpStatus.BAD_REQUEST).json({
			errors: [
				{
					title: "Bad request",
					detail: "Invalid email or password",
					status: HttpStatus.BAD_REQUEST
				}
			]
		});
	}

	@Get("login/google")
	loginConsent(@Res() res: Response) {
		this.log.info("GET", "/accounts/login/google", 307);
		const link = this.authService.generateGoogleAuthUrl();
		res.status(HttpStatus.TEMPORARY_REDIRECT).redirect(link)
	}

	@Get("login/google/callback")
	async loginWithGoogle(@Query("code") code: string, @Res() res: Response) {
		const result = await this.authService.loginWithGoogle(code);
		this.setTokenPair(res, result);
		this.log.info("GET", "/accounts/login/google/callback", 200);

		res.redirect(process.env.FRONTEND_URL!)
	}

	@UseGuards(JwtGuard)
	@Post("logout")
	@HttpCode(HttpStatus.NO_CONTENT)
	logout(@Res({ passthrough: true }) res: Response) {
		res.clearCookie("access");
		res.clearCookie("refresh");

		this.log.info("POST", "/account/logout", 204);
	}

	//delete user and I think it all about this method
	@UseGuards(JwtGuard)
	@Delete()
	@HttpCode(HttpStatus.NO_CONTENT)
	async deleteAccount(
		@CurrentUser() user: Express.User,
		@Res({ passthrough: true }) res: Response
	) {
		await this.authService.deleteAccount(user.id);
		res.clearCookie("access");
		res.clearCookie("refresh");

		this.log.info("DELETE", "/account", 204);
	}

	@UseGuards(JwtGuard)
	@Post("me/verify-email")
	@HttpCode(HttpStatus.NO_CONTENT)
	async requestEmailVerification(@CurrentUser() user: Express.User) {
		await this.authService.requestEmailVerification(user.id);
		this.log.info("POST", "/accounts/me/verify-email", 204);
	}

	@UseGuards(JwtGuard)
	@Post("me/verify-email/confirm")
	@HttpCode(HttpStatus.NO_CONTENT)
	async confirmEmailVerification(
		@CurrentUser() user: Express.User,
		@Body() dto: VerifyEmailConfirmDto
	) {
		await this.authService.confirmEmailVerification(user.id, dto.data.attributes.code);
		this.log.info("POST", "/accounts/me/verify-email/confirm", 204);
	}

	@UseGuards(JwtRefreshGuard)
	@Post("refresh")
	@HttpCode(HttpStatus.OK)
	async refresh(@CurrentUser() user: Express.User, @Res() res: Response) {
		const tokens = await this.authService.refresh(user.id);
		this.setTokenPair(res, tokens);
		this.log.info("POST", "/account/refresh", 200);

		res.send();
	}

	private setTokenPair(res: Response, tokens: TokenPair) {
		res.cookie("access", tokens.access.token, {
			expires: new Date(tokens.access.expires)
		});

		res.cookie("refresh", tokens.refresh.token, {
			httpOnly: true,
			expires: new Date(tokens.refresh.expires)
		});
	}
}
