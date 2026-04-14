import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Transform } from "class-transformer";

export const NullIfEmpty = () =>
	Transform(({ value }) => (value === '' ? null : value));

export const CurrentUser = createParamDecorator(
	(data: unknown, ctx: ExecutionContext): Express.User => {
		const request = ctx.switchToHttp().getRequest();
		return request.user;
	},
);
