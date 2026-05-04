import {
	BaseEntity,
	Column,
	CreateDateColumn,
	DeleteDateColumn,
	Entity,
	PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'images' })
export class Image extends BaseEntity {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ name: 'account_id', type: 'uuid', nullable: true })
	accountId: string | null;

	@Column({ length: 255 })
	name: string;

	@Column({ name: 's3_key', length: 512 })
	s3Key: string;

	@Column({ name: 'mime_type', length: 100 })
	mimeType: string;

	@Column({ default: false })
	public: boolean;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
	createdAt: Date;

	@DeleteDateColumn({ name: 'deleted_at', type: 'timestamp with time zone', nullable: true })
	deletedAt: Date | null;
}
