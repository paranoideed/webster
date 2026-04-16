import {
	BaseEntity,
	Column,
	CreateDateColumn,
	DeleteDateColumn,
	Entity,
	PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'canvases' })
export class Canva extends BaseEntity {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ name: 'project_id', type: 'uuid' })
	projectId: string;

	@Column({ length: 255 })
	name: string;

	@CreateDateColumn({
		name: 'created_at',
		type: 'timestamp with time zone',
	})
	createdAt: Date;

	@DeleteDateColumn({
		name: 'deleted_at',
		type: 'timestamp with time zone',
		nullable: true,
	})
	deletedAt: Date | null;
}
