import {
	BaseEntity,
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { Project } from './project.entity';

@Entity({ name: 'project_invites' })
export class ProjectInvite extends BaseEntity {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ name: 'project_id', type: 'uuid' })
	projectId: string;

	@Column({ length: 256 })
	email: string;

	@Column({ unique: true, length: 64 })
	token: string;

	@Column({
		name: 'expires_at',
		type: 'timestamp with time zone',
	})
	expiresAt: Date;

	@CreateDateColumn({
		name: 'created_at',
		type: 'timestamp with time zone',
	})
	createdAt: Date;

	@ManyToOne(() => Project, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'project_id' })
	project: Project;

}
