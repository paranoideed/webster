import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { GlobalExceptionFilter } from "./modules/shared/exception.filter";

async function bootstrap() {
	const app = await NestFactory.create(AppModule, { rawBody: true });
	app.setGlobalPrefix("webster/v1");
	app.enableCors({ origin: process.env.FRONTEND_URL, credentials: true })
	app.use(cookieParser());
	app.useGlobalFilters(new GlobalExceptionFilter());
	app.useGlobalPipes(
		new ValidationPipe({ whitelist: true, transform: true })
	);
	await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
