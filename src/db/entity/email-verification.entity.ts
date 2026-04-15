import {
	BaseEntity,
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { Account } from './account.entity';

@Entity({ name: 'email_verifications' })
export class EmailVerification extends BaseEntity {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ name: 'account_id', type: 'uuid' })
	accountId: string;

	@Column({ unique: true, length: 256 })
	code: string;

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

	@ManyToOne(() => Account, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'account_id' })
	account: Account;
}
