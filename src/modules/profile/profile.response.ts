import { Profile } from "src/db/entity/profile.entity";
import { buildFileUrl, stripNulls } from "../shared/s3.uploader";

export function profileData(profile: Profile) {
	return {
		id: profile.accountId,
		type: "profile",
		attributes: stripNulls({
			username: profile.username,
			avatar_url: buildFileUrl(profile.avatarKey),
			updated_at: profile.updatedAt,
			created_at: profile.createdAt
		})
	};
}

export function profileResponse(profile: Profile) {
	return {
		data: profileData(profile)
	};
}

export function profilesResponse(
	profiles: Profile[],
	total: number,
	limit: number,
	offset: number,
	baseUrl: string
) {
	const currentPage = Math.floor(offset / limit);
	const lastPage = Math.max(0, Math.floor((total - 1) / limit));

	return {
		data: profiles.map(profileData),
		links: stripNulls({
			self: `${baseUrl}?page[limit]=${limit}&page[offset]=${offset}`,
			first: `${baseUrl}?page[limit]=${limit}&page[offset]=0`,
			last: `${baseUrl}?page[limit]=${limit}&page[offset]=${lastPage * limit}`,
			prev:
				currentPage > 0
					? `${baseUrl}?page[limit]=${limit}&page[offset]=${(currentPage - 1) * limit}`
					: null,
			next:
				currentPage < lastPage
					? `${baseUrl}?page[limit]=${limit}&page[offset]=${(currentPage + 1) * limit}`
					: null
		})
	};
}
