import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Logger, UseFilters } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { CanvaWsService, CommitPayload, UndoRedoPayload } from './canva.ws.service';

/** Cookie header parser — extracts a single cookie value by name. */
function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  const match = header.split(';').find((c) => c.trim().startsWith(`${name}=`));
  return match ? decodeURIComponent(match.trim().slice(name.length + 1)) : undefined;
}

/** Prefix for Socket.IO room names: `canva:<canvaId>`. */
const roomName = (canvaId: string) => `canva:${canvaId}`;

/**
 * WebSocket gateway for real-time canvas collaboration.
 *
 * Transport: Socket.IO, namespace /canvas.
 * Auth: JWT access token from the `access` cookie, verified synchronously
 * in the Socket.IO `connection` middleware before any event handler runs.
 *
 * Client must emit `join` before any other event.
 */
@WebSocketGateway({ namespace: '/canvas', cors: { origin: process.env.FRONTEND_URL, credentials: true } })
export class CanvaGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(CanvaGateway.name);

  constructor(
    private readonly canvaWsService: CanvaWsService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Called by Socket.IO before the connection is accepted.
   * We register a middleware that verifies the JWT access token from cookies.
   * If the token is missing or invalid the socket is disconnected immediately.
   */
  afterInit(server: Server) {
    server.use((socket, next) => {
      const cookieHeader = socket.handshake.headers.cookie;
      const token = parseCookie(cookieHeader, 'access');

      if (!token) {
        next(new Error('Unauthorized: missing access token'));
        return;
      }

      try {
        const payload = this.jwtService.verify<{ sub: string; role: string }>(token);
        // Attach accountId to socket.data so every handler can read it without
        // re-verifying the token.
        socket.data.accountId = payload.sub;
        next();
      } catch {
        next(new Error('Unauthorized: invalid access token'));
      }
    });
  }

  /**
   * Required by OnGatewayConnection; authentication is handled in afterInit
   * middleware, so we only log here.
   */
  handleConnection(socket: Socket) {
    this.logger.log(`Socket connected: ${socket.id} (account ${socket.data.accountId})`);
  }

  /**
   * join — client enters a canvas room.
   *
   * Payload: { canvaId: string }
   *
   * 1. Validates membership.
   * 2. Adds the socket to the room `canva:<canvaId>`.
   * 3. Loads the current canvas state from Cassandra (latest snapshot + commits
   *    after it) and emits `joined` back to the sender with the full state.
   */
  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { canvaId: string },
  ) {
    const { canvaId } = payload;
    const accountId: string = socket.data.accountId;

    try {
      await this.canvaWsService.checkAccess(accountId, canvaId);
    } catch (err: any) {
      socket.emit('error', { message: err.message ?? 'Access denied' });
      return;
    }

    await socket.join(roomName(canvaId));
    this.logger.log(`Account ${accountId} joined canvas ${canvaId}`);

    try {
      const state = await this.canvaWsService.getCanvasState(canvaId);
      socket.emit('joined', state);
    } catch (err: any) {
      this.logger.error(`Failed to load state for canvas ${canvaId}`, err);
      socket.emit('error', { message: 'Failed to load canvas state' });
    }
  }

  /**
   * commit — client pushes a new set of operations.
   *
   * Payload: { canvaId: string; previous: number; changes: Operation[] }
   *
   * 1. Validates write access (editor or owner only).
   * 2. Stores the commit with optimistic concurrency (retry on conflict).
   * 3. Broadcasts `commit:ack` with the stored commit to all room members.
   * 4. If the commit triggered a new snapshot, broadcasts `snapshot` with
   *    the updated state (snapshot + remaining commits) to all room members.
   */
  @SubscribeMessage('commit')
  async handleCommit(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { canvaId: string } & CommitPayload,
  ) {
    const { canvaId, previous, changes } = payload;
    const accountId: string = socket.data.accountId;

    try {
      await this.canvaWsService.checkWriteAccess(accountId, canvaId);
    } catch (err: any) {
      socket.emit('commit:error', { message: err.message ?? 'Access denied' });
      return;
    }

    let result: Awaited<ReturnType<CanvaWsService['processCommit']>>;
    try {
      result = await this.canvaWsService.processCommit(canvaId, { previous, changes });
    } catch (err: any) {
      this.logger.error(`Commit failed for canvas ${canvaId}`, err);
      socket.emit('commit:error', { message: 'Commit failed, please retry' });
      return;
    }

    // Broadcast the accepted commit to everyone in the room (including sender).
    this.server.to(roomName(canvaId)).emit('commit:ack', result.commit);

    // If a new snapshot was computed, push the updated state to all room members.
    if (result.newState) {
      this.server.to(roomName(canvaId)).emit('snapshot', result.newState);
    }
  }

  /**
   * undo — client moves its local head one step backward and asks all
   * room members to re-render at the new position.
   *
   * Payload: { canvaId: string; head: number }
   *
   * The server does NOT persist this — it simply broadcasts `{ head }` to
   * everyone in the room. Each client independently applies:
   *   buildSnapshot(snapshot, commits.slice(0, head))
   */
  @SubscribeMessage('undo')
  async handleUndo(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { canvaId: string } & UndoRedoPayload,
  ) {
    const { canvaId, head } = payload;
    const accountId: string = socket.data.accountId;

    try {
      await this.canvaWsService.checkAccess(accountId, canvaId);
    } catch (err: any) {
      socket.emit('error', { message: err.message ?? 'Access denied' });
      return;
    }

    this.server.to(roomName(canvaId)).emit('undo', { head });
  }

  /**
   * redo — client moves its local head one step forward and asks all
   * room members to re-render at the new position.
   *
   * Payload: { canvaId: string; head: number }
   *
   * Same semantics as undo: broadcast-only, no persistence.
   */
  @SubscribeMessage('redo')
  async handleRedo(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { canvaId: string } & UndoRedoPayload,
  ) {
    const { canvaId, head } = payload;
    const accountId: string = socket.data.accountId;

    try {
      await this.canvaWsService.checkAccess(accountId, canvaId);
    } catch (err: any) {
      socket.emit('error', { message: err.message ?? 'Access denied' });
      return;
    }

    this.server.to(roomName(canvaId)).emit('redo', { head });
  }
}
