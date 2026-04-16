import { Operation } from 'src/draw/operation';

export interface Commit {
	number: number;
	previous: number;
	changes: Operation[];
}
