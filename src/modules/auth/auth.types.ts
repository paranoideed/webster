export enum UserRole {
	ADMIN = "admin",
	USER = "user"
}

export type TokenPair = {
	access: {
		token: string;
		expires: number;
	};
	refresh: {
		token: string;
		expires: number;
	};
};

export type GoogleIdTokenPayload = {
	given_name: string;
	family_name: string;
	picture: string;
	email: string;
};
