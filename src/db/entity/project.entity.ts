import {
	BaseEntity,
	Column,
	CreateDateColumn,
	DeleteDateColumn,
	Entity,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'projects' })
export class Project extends BaseEntity {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ length: 255 })
	name: string;

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
}
