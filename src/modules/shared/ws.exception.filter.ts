import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';

const errorEventMap: Record<string, string> = {
	commit: 'commit:error',
	undo: 'undo:error',
	redo: 'redo:error',
};

@Catch()
export class WsExceptionFilter implements ExceptionFilter {
	private readonly logger = new Logger(WsExceptionFilter.name);

	catch(exception: unknown, host: ArgumentsHost) {
		const socket = host.switchToWs().getClient<Socket>();
		const event = host.switchToWs().getPattern() as string;

		let message: string;
		let errors: string[] | undefined;

		if (exception instanceof BadRequestException) {
			const response = exception.getResponse() as any;
			message = 'Validation failed';
			errors = Array.isArray(response.message) ? response.message : [response.message];
		} else if (exception instanceof Error) {
			message = exception.message;
		} else {
			message = 'Internal server error';
		}

		this.logger.error(`WS error on event "${event}" (socket ${socket.id}): ${errors ?? message}`);

		const errorEvent = errorEventMap[event] ?? 'error';
		socket.emit(errorEvent, { message, ...(errors && { errors }) });
	}
}
