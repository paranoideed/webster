import {
	ArgumentsHost,
	Catch,
	ExceptionFilter,
	HttpException,
	HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppLogger } from './logger';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
	private readonly log = new AppLogger(GlobalExceptionFilter.name);

	catch(exception: unknown, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const req = ctx.getRequest<Request>();
		const res = ctx.getResponse<Response>();

		const status =
			exception instanceof HttpException
				? exception.getStatus()
				: HttpStatus.INTERNAL_SERVER_ERROR;

		const response =
			exception instanceof HttpException
				? exception.getResponse()
				: 'Unexpected error';

		const detail =
			typeof response === 'object' && response !== null
				? response
				: String(response);

		if (status >= 500) {
			this.log.error(
				req.method,
				req.path,
				status,
				exception instanceof Error ? exception.message : 'Unexpected error',
				exception instanceof Error ? exception.stack : undefined,
			);
		} else {
			this.log.warn(req.method, req.path, status, JSON.stringify(detail));
		}

		res.status(status).json({
			errors: [{ status, detail }],
		});
	}
}
