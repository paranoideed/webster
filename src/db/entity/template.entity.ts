import {
	BaseEntity,
	Column,
	CreateDateColumn,
	DeleteDateColumn,
	Entity,
	PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'templates' })
export class Template extends BaseEntity {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ name: 'account_id', type: 'uuid', nullable: true })
	accountId: string | null;

	@Column({ length: 255 })
	name: string;

	@Column({ type: 'jsonb' })
	body: object;

	@Column({ default: false })
	public: boolean;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
	createdAt: Date;

	@DeleteDateColumn({ name: 'deleted_at', type: 'timestamp with time zone', nullable: true })
	deletedAt: Date | null;
}
