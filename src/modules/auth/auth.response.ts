import { Account } from "src/db/entity/account.entity";

export const accountResponse = (account: Account) => {
	return {
		data: {
			id: account.id,
			type: "account",
			attributes: {
				role: account.role,
				email: account.email,
				updated_at: account.updatedAt,
				created_at: account.createdAt
			},
			relationships: {
				profile: {
					data: {
						id: account.id,
						type: "profile"
					}
				}
			}
		}
	};
};
