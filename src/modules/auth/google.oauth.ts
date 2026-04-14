import { Injectable } from "@nestjs/common";
import { OAuth2Client } from "google-auth-library";

@Injectable()
export class GoogleOAuth {
	private client = new OAuth2Client(
		process.env.GOOGLE_CLIENT_ID,
		process.env.GOOGLE_CLIENT_SECRET,
		process.env.GOOGLE_REDIRECT_URI
	);

	generateAuthUrl() {
		return this.client.generateAuthUrl({
			access_type: "offline",
			scope: ["profile", "email"]
		});
	}

	async authenticate(code: string) {
		const { tokens } = await this.client.getToken(code);
		this.client.setCredentials({
			access_token: tokens.access_token,
			refresh_token: tokens.refresh_token,
			id_token: tokens.id_token
		});
		return tokens;
	}
}
