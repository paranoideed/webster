import {
	Injectable,
	NotFoundException,
	ForbiddenException
} from "@nestjs/common";
import { database } from "src/db/data-source";
import { Profile } from "src/db/entity/profile.entity";
import { UpdateProfileDto, FilterProfilesDto } from "./profile.dto";
import { S3Service } from "../shared/s3.uploader";

@Injectable()
export class ProfileService {
	constructor(private s3Service: S3Service) {}

	async getMyProfile(accountId: string): Promise<Profile> {
		const profile = await database.dataSource.manager.findOneBy(Profile, {
			accountId
		});
		if (!profile) throw new NotFoundException("Profile not found");
		return profile;
	}

	async updateMyProfile(
		accountId: string,
		dto: UpdateProfileDto
	): Promise<Profile> {
		if (dto.data.id !== accountId) {
			throw new ForbiddenException(
				"Cannot update another user's profile"
			);
		}
		const profile = await this.getMyProfile(accountId);
		const attrs = dto.data.attributes;
		if (attrs?.username) profile.username = attrs.username;
		await profile.save();
		return profile;
	}

	async uploadAvatar(
		accountId: string,
		file: Express.Multer.File
	): Promise<Profile> {
		const profile = await this.getMyProfile(accountId);
		if (profile.avatarKey) {
			await this.s3Service.deleteObject(profile.avatarKey);
		}
		const { key } = await this.s3Service.putProfileAvatar(
			accountId,
			file.buffer,
			file.mimetype
		);
		profile.avatarKey = key;
		await profile.save();
		return profile;
	}

	async deleteAvatar(accountId: string): Promise<void> {
		const profile = await this.getMyProfile(accountId);
		if (!profile.avatarKey) {
			throw new NotFoundException("Avatar not found");
		}
		await this.s3Service.deleteObject(profile.avatarKey);
		profile.avatarKey = null;
		await profile.save();
	}

	async getProfileById(accountId: string): Promise<Profile> {
		const profile = await database.dataSource.manager.findOne(Profile, {
			where: { accountId },
			relations: { account: true }
		});
		if (!profile || profile.account.deletedAt) {
			throw new NotFoundException("Profile not found");
		}
		return profile;
	}

	async getProfileByUsername(username: string): Promise<Profile> {
		const profile = await database.dataSource.manager.findOne(Profile, {
			where: { username },
			relations: { account: true }
		});
		if (!profile || profile.account.deletedAt) {
			throw new NotFoundException("Profile not found");
		}
		return profile;
	}

	async filterProfiles(dto: FilterProfilesDto): Promise<[Profile[], number]> {
		const qb = database.dataSource.manager
			.createQueryBuilder(Profile, "profile")
			.innerJoin("profile.account", "account")
			.where("account.deleted_at IS NULL");

		if (dto.text) {
			qb.andWhere("profile.username ILIKE :text", {
				text: `${dto.text}%`
			});
		}

		qb.limit(dto["page[limit]"] ?? 20);
		qb.offset(dto["page[offset]"] ?? 0);

		return qb.getManyAndCount();
	}
}
