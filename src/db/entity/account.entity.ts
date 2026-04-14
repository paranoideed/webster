import {
	Entity,
	Column,
	CreateDateColumn,
	UpdateDateColumn,
	DeleteDateColumn,
	BaseEntity,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { UserRole } from 'src/modules/auth/auth.types';

@Entity({ name: 'accounts' })
export class Account extends BaseEntity {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ unique: true, length: 256 })
	email: string;

	@Column({ default: false })
	verified: boolean;

	@Column({
		type: 'enum',
		enum: UserRole,
		default: UserRole.USER,
	})
	role: UserRole;

	@Column({ length: 256, nullable: true })
	password: string;

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
		nullable: true,
		type: 'timestamp with time zone',
	})
	deletedAt: Date;
}
