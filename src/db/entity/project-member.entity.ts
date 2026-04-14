import {
	BaseEntity,
	Column,
	CreateDateColumn,
	DeleteDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	Unique,
	UpdateDateColumn,
} from 'typeorm';
import { Account } from './account.entity';
import { Project } from './project.entity';

export enum ProjectMemberRole {
	OWNER  = 'owner',
	EDITOR = 'editor',
	VIEWER = 'viewer',
}

@Entity({ name: 'project_members' })
@Unique(['accountId', 'projectId'])
export class ProjectMember extends BaseEntity {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ name: 'account_id', type: 'uuid' })
	accountId: string;

	@Column({ name: 'project_id', type: 'uuid' })
	projectId: string;

	@Column({
		type: 'enum',
		enum: ProjectMemberRole,
		default: ProjectMemberRole.VIEWER,
	})
	role: ProjectMemberRole;

	@CreateDateColumn({
		name: 'created_at',
		type: 'timestamp with time zone',
	})
	createdAt: Date;

	@UpdateDateColumn({
		name: 'updated_at',
		type: 'timestamp with time zone',
	})
	updatedAt: Date;

	@DeleteDateColumn({
		name: 'deleted_at',
		type: 'timestamp with time zone',
		nullable: true,
	})
	deletedAt: Date | null;

	@ManyToOne(() => Account, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'account_id' })
	account: Account;

	@ManyToOne(() => Project, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'project_id' })
	project: Project;
}
