import {
	ConnectedSocket,
	MessageBody,
	OnGatewayConnection,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
} from '@nestjs/websockets';
import { Logger, UseFilters, UsePipes, ValidationPipe } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsExceptionFilter } from '../shared/ws.exception.filter';
import { JwtService } from '@nestjs/jwt';
import { DrawService, CommitResult } from './draw.service';
import { JoinWsDto, CommitWsDto, UndoRedoWsDto } from './draw.dto';
import { validateCommitChanges } from '@paranoideed/drawebster';

function parseCookie(header: string | undefined, name: string): string | undefined {
	if (!header) return undefined;
	const match = header.split(';').find((c) => c.trim().startsWith(`${name}=`));
	return match ? decodeURIComponent(match.trim().slice(name.length + 1)) : undefined;
}

const roomName = (canvaId: string) => `canva:${canvaId}`;

@UseFilters(new WsExceptionFilter())
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@WebSocketGateway({ namespace: '/canvas', cors: { origin: process.env.FRONTEND_URL, credentials: true } })
export class DrawGateway implements OnGatewayConnection {
	@WebSocketServer()
	private server!: Server;

	private readonly logger = new Logger(DrawGateway.name);

	constructor(
		private readonly drawService: DrawService,
		private readonly jwtService: JwtService,
	) {}

	afterInit(server: Server) {
		server.use((socket, next) => {
			const cookieHeader = socket.handshake.headers.cookie;
			const token =
				parseCookie(cookieHeader, 'access') ||
				(socket.handshake.auth?.token as string | undefined) ||
				(socket.handshake.query?.token as string | undefined);

			if (!token) {
				next(new Error('Unauthorized: missing access token'));
				return;
			}

			try {
				const payload = this.jwtService.verify<{ sub: string; role: string }>(token);
				socket.data.accountId = payload.sub;
				next();
			} catch {
				next(new Error('Unauthorized: invalid access token'));
			}
		});
	}

	handleConnection(socket: Socket) {
		this.logger.log(`Socket connected: ${socket.id} (account ${socket.data.accountId})`);
	}

	@SubscribeMessage('join')
	async handleJoin(
		@ConnectedSocket() socket: Socket,
		@MessageBody() payload: JoinWsDto,
	) {
		const { canva_id } = payload;
		const accountId: string = socket.data.accountId;

		try {
			await this.drawService.checkAccess(accountId, canva_id);
		} catch (err: any) {
			socket.emit('error', { message: err.message ?? 'Access denied' });
			return;
		}

		socket.data.canvaId = canva_id;
		await socket.join(roomName(canva_id));
		this.logger.log(`Account ${accountId} joined canvas ${canva_id}`);

		try {
			const state = await this.drawService.getCanvasState(canva_id);
			socket.emit('joined', state);
		} catch (err: any) {
			this.logger.error(`Failed to load state for canvas ${canva_id}`, err);
			socket.emit('error', { message: 'Failed to load canvas state' });
		}
	}

	@SubscribeMessage('commit')
	async handleCommit(
		@ConnectedSocket() socket: Socket,
		@MessageBody() payload: CommitWsDto,
	) {
		const { previous, changes } = payload;
		const accountId: string = socket.data.accountId;
		const canvaId: string = socket.data.canvaId;

		if (!canvaId) {
			socket.emit('commit:error', { message: 'Not joined to any canvas' });
			return;
		}

		try {
			await this.drawService.checkWriteAccess(accountId, canvaId);
		} catch (err: any) {
			socket.emit('commit:error', { message: err.message ?? 'Access denied' });
			return;
		}

		const validation = validateCommitChanges(changes);
		if (!validation.valid) {
			this.logger.warn(`Invalid commit from account ${accountId} on canvas ${canvaId}: ${validation.errors.join(', ')}`);
			socket.emit('commit:error', { message: 'Invalid changes', errors: validation.errors });
			return;
		}

		let result: CommitResult;
		try {
			result = await this.drawService.processCommit(canvaId, { previous, changes: changes as any });
		} catch (err: any) {
			this.logger.error(`Commit failed for canvas ${canvaId}`, err);
			socket.emit('commit:error', { message: 'Commit failed, please retry' });
			return;
		}

		this.server.to(roomName(canvaId)).emit('commit:ack', result.commit);

		if (result.new_state) {
			this.server.to(roomName(canvaId)).emit('snapshot', result.new_state);
		}
	}

	@SubscribeMessage('undo')
	async handleUndo(
		@ConnectedSocket() socket: Socket,
		@MessageBody() payload: UndoRedoWsDto,
	) {
		const { head } = payload;
		const accountId: string = socket.data.accountId;
		const canvaId: string = socket.data.canvaId;

		if (!canvaId) {
			socket.emit('undo:error', { message: 'Not joined to any canvas' });
			return;
		}

		try {
			await this.drawService.checkAccess(accountId, canvaId);
		} catch (err: any) {
			socket.emit('undo:error', { message: err.message ?? 'Access denied' });
			return;
		}

		const error = await this.drawService.validateHead(canvaId, head);
		if (error) {
			socket.emit('undo:error', { message: error });
			return;
		}

		this.server.to(roomName(canvaId)).emit('undo', { head });
	}

	@SubscribeMessage('redo')
	async handleRedo(
		@ConnectedSocket() socket: Socket,
		@MessageBody() payload: UndoRedoWsDto,
	) {
		const { head } = payload;
		const accountId: string = socket.data.accountId;
		const canvaId: string = socket.data.canvaId;

		if (!canvaId) {
			socket.emit('redo:error', { message: 'Not joined to any canvas' });
			return;
		}

		try {
			await this.drawService.checkAccess(accountId, canvaId);
		} catch (err: any) {
			socket.emit('redo:error', { message: err.message ?? 'Access denied' });
			return;
		}

		const error = await this.drawService.validateHead(canvaId, head);
		if (error) {
			socket.emit('redo:error', { message: error });
			return;
		}

		this.server.to(roomName(canvaId)).emit('redo', { head });
	}
}
