import { Logger } from '@nestjs/common';

enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3,
}

function currentLevel(): LogLevel {
	const raw = (process.env.LOG_LEVEL ?? 'INFO').toUpperCase();
	return (
		(LogLevel[raw as keyof typeof LogLevel] as unknown as LogLevel) ??
		LogLevel.INFO
	);
}

function format(
	method: string,
	path: string,
	status?: number,
	detail?: string,
): string {
	let msg = `${method} ${path}`;
	if (status !== undefined) msg += ` -> ${status}`;
	if (detail) msg += ` ${detail}`;
	return msg;
}

export class AppLogger {
	private readonly logger: Logger;

	constructor(context: string) {
		this.logger = new Logger(context);
	}

	debug(method: string, path: string, status?: number, detail?: string) {
		if (currentLevel() <= LogLevel.DEBUG)
			this.logger.debug(format(method, path, status, detail));
	}

	info(method: string, path: string, status?: number, detail?: string) {
		if (currentLevel() <= LogLevel.INFO)
			this.logger.log(format(method, path, status, detail));
	}

	warn(method: string, path: string, status?: number, detail?: string) {
		if (currentLevel() <= LogLevel.WARN)
			this.logger.warn(format(method, path, status, detail));
	}

	error(
		method: string,
		path: string,
		status?: number,
		detail?: string,
		trace?: string,
	) {
		if (currentLevel() <= LogLevel.ERROR)
			this.logger.error(format(method, path, status, detail), trace);
	}
}
