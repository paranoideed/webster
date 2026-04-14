import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { Account } from "src/db/entity/account.entity";
import { Profile } from "src/db/entity/profile.entity";
import { AppLogger } from "../shared/logger";

@Injectable()
export class MailService {
	private readonly transporter: nodemailer.Transporter;
	private readonly from: string;
	private readonly log = new AppLogger(MailService.name);

	constructor(private config: ConfigService) {
		this.transporter = nodemailer.createTransport({
			host: config.get<string>("SMTP_HOST"),
			port: config.get<number>("SMTP_PORT") ?? 587,
			secure: false,
			auth: {
				user: config.get<string>("SMTP_USER"),
				pass: config.get<string>("SMTP_PASS")
			}
		});
		this.from = config.get<string>("SMTP_FROM") ?? "noreply@webster.com";
	}

	async welcomeEmail(accountId: string): Promise<void> {
		const [account, profile] = await Promise.all([
			Account.findOneBy({ id: accountId }),
			Profile.findOneBy({ accountId })
		]);
		if (!account) return;

		const name = profile?.username ?? account.email;
		const html = this.wrap(
			"Welcome to webster! 🎉",
			`
			<div style="text-align:center; padding: 8px 0 24px;">
				<div style="font-size:52px; margin-bottom:8px;">🎊</div>
				<h1 style="margin:0 0 8px; color:#1e1b4b; font-size:26px;">Welcome, ${this.esc(name)}!</h1>
				<p style="color:#6b7280; margin:0 0 24px; font-size:15px;">Your account is ready. Discover events, grab tickets, and create unforgettable memories.</p>
			</div>
			<div style="background:#f5f3ff; border-radius:12px; padding:20px 24px; margin-bottom:24px;">
				<p style="margin:0; color:#4f46e5; font-size:14px; font-weight:600;">✨ What you can do on webster</p>
				<ul style="margin:12px 0 0; padding-left:20px; color:#374151; font-size:14px; line-height:1.8;">
					<li>Browse and purchase tickets to events</li>
					<li>Follow companies and get news updates</li>
					<li>Create your own events and manage ticket sales</li>
				</ul>
			</div>
			<div style="text-align:center;">
				<a href="${this.config.get("FRONTEND_URL") ?? "#"}" style="display:inline-block; background:#4f46e5; color:#fff; text-decoration:none; padding:12px 32px; border-radius:8px; font-size:15px; font-weight:600;">Explore Events →</a>
			</div>
			`
		);

		try {
			await this.transporter.sendMail({
				from: this.from,
				to: account.email,
				subject: `Welcome to webster, ${name}! 🎉`,
				html
			});
		} catch (err) {
			this.log.error("MAIL", "welcomeEmail", 500, err.message, err.stack);
		}
	}

	async loginNotification(accountId: string): Promise<void> {
		const [account, profile] = await Promise.all([
			Account.findOneBy({ id: accountId }),
			Profile.findOneBy({ accountId })
		]);
		if (!account) return;

		const name = profile?.username ?? account.email;
		const time = new Date().toUTCString();
		const html = this.wrap(
			"New sign-in to your account",
			`
			<div style="text-align:center; padding: 8px 0 24px;">
				<div style="font-size:48px; margin-bottom:8px;">🔐</div>
				<h1 style="margin:0 0 8px; color:#1e1b4b; font-size:24px;">New sign-in detected</h1>
				<p style="color:#6b7280; margin:0; font-size:15px;">Hi <strong>${this.esc(name)}</strong>, we noticed a new sign-in to your webster account.</p>
			</div>
			<div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:20px 24px; margin-bottom:24px;">
				<p style="margin:0 0 8px; color:#166534; font-size:13px; font-weight:600; text-transform:uppercase; letter-spacing:.5px;">Sign-in details</p>
				<table style="width:100%; border-collapse:collapse; font-size:14px; color:#374151;">
					<tr>
						<td style="padding:6px 0; color:#6b7280; width:40%;">Account</td>
						<td style="padding:6px 0;">${this.esc(account.email)}</td>
					</tr>
					<tr>
						<td style="padding:6px 0; color:#6b7280;">Time</td>
						<td style="padding:6px 0;">${time}</td>
					</tr>
				</table>
			</div>
			<div style="background:#fef2f2; border:1px solid #fecaca; border-radius:12px; padding:16px 20px;">
				<p style="margin:0; color:#991b1b; font-size:14px;">⚠️ If this wasn't you, please change your password immediately and contact support.</p>
			</div>
			`
		);

		try {
			await this.transporter.sendMail({
				from: this.from,
				to: account.email,
				subject: "New sign-in to your webster account",
				html
			});
		} catch (err) {
			this.log.error("MAIL", "loginNotification", 500, err.message, err.stack);
		}
	}

	async sendVerificationCode(accountId: string, code: string): Promise<void> {
		const [account, profile] = await Promise.all([
			Account.findOneBy({ id: accountId }),
			Profile.findOneBy({ accountId })
		]);
		if (!account) return;

		const name = profile?.username ?? account.email;
		const expiresMin = 5;
		const html = this.wrap(
			"Verify your email address",
			`
			<div style="text-align:center; padding: 8px 0 24px;">
				<div style="font-size:48px; margin-bottom:8px;">✉️</div>
				<h1 style="margin:0 0 8px; color:#1e1b4b; font-size:24px;">Confirm your email</h1>
				<p style="color:#6b7280; margin:0; font-size:15px;">Hi <strong>${this.esc(name)}</strong>, use the code below to verify your email address.</p>
			</div>
			<div style="text-align:center; margin:24px 0;">
				<div style="display:inline-block; background:#f5f3ff; border:2px dashed #7c3aed; border-radius:12px; padding:20px 40px;">
					<span style="font-size:36px; font-weight:800; letter-spacing:10px; color:#4f46e5;">${this.esc(code)}</span>
				</div>
			</div>
			<div style="background:#fefce8; border:1px solid #fde68a; border-radius:12px; padding:14px 20px; margin-bottom:24px; text-align:center;">
				<p style="margin:0; color:#92400e; font-size:13px;">⏱ This code expires in <strong>${expiresMin} minutes</strong>.</p>
			</div>
			<div style="background:#f9fafb; border-radius:12px; padding:14px 20px;">
				<p style="margin:0; color:#6b7280; font-size:13px;">If you didn't request this, you can safely ignore the email — your account won't be affected.</p>
			</div>
			`
		);

		try {
			await this.transporter.sendMail({
				from: this.from,
				to: account.email,
				subject: "Your webster verification code",
				html
			});
		} catch (err) {
			this.log.error("MAIL", "sendVerificationCode", 500, err.message, err.stack);
		}
	}

	async emailVerificationSuccess(accountId: string): Promise<void> {
		const [account, profile] = await Promise.all([
			Account.findOneBy({ id: accountId }),
			Profile.findOneBy({ accountId })
		]);
		if (!account) return;

		const name = profile?.username ?? account.email;
		const time = new Date().toUTCString();
		const html = this.wrap(
			"Your email has been verified",
			`
			<div style="text-align:center; padding: 8px 0 24px;">
				<div style="font-size:52px; margin-bottom:8px;">✅</div>
				<h1 style="margin:0 0 8px; color:#1e1b4b; font-size:24px;">Email verified!</h1>
				<p style="color:#6b7280; margin:0; font-size:15px;">Hi <strong>${this.esc(name)}</strong>, your email address has been successfully confirmed.</p>
			</div>
			<div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:20px 24px; margin-bottom:24px;">
				<table style="width:100%; border-collapse:collapse; font-size:14px; color:#374151;">
					<tr>
						<td style="padding:6px 0; color:#6b7280; width:40%;">Account</td>
						<td style="padding:6px 0;">${this.esc(account.email)}</td>
					</tr>
					<tr>
						<td style="padding:6px 0; color:#6b7280;">Time</td>
						<td style="padding:6px 0;">${time}</td>
					</tr>
				</table>
			</div>
			<div style="background:#fef2f2; border:1px solid #fecaca; border-radius:12px; padding:16px 20px;">
				<p style="margin:0; color:#991b1b; font-size:14px;">⚠️ If you did not do this, please contact us immediately at <a href="mailto:support@webster.com" style="color:#991b1b;">support@webster.com</a>.</p>
			</div>
			`
		);

		try {
			await this.transporter.sendMail({
				from: this.from,
				to: account.email,
				subject: "Your webster email has been verified",
				html
			});
		} catch (err) {
			this.log.error("MAIL", "emailVerificationSuccess", 500, err.message, err.stack);
		}
	}

	async emailVerificationFailed(accountId: string): Promise<void> {
		const [account, profile] = await Promise.all([
			Account.findOneBy({ id: accountId }),
			Profile.findOneBy({ accountId })
		]);
		if (!account) return;

		const name = profile?.username ?? account.email;
		const time = new Date().toUTCString();
		const html = this.wrap(
			"Failed email verification attempt",
			`
			<div style="text-align:center; padding: 8px 0 24px;">
				<div style="font-size:52px; margin-bottom:8px;">⚠️</div>
				<h1 style="margin:0 0 8px; color:#1e1b4b; font-size:24px;">Failed verification attempt</h1>
				<p style="color:#6b7280; margin:0; font-size:15px;">Hi <strong>${this.esc(name)}</strong>, someone entered an incorrect or expired verification code for your account.</p>
			</div>
			<div style="background:#fef2f2; border:1px solid #fecaca; border-radius:12px; padding:20px 24px; margin-bottom:24px;">
				<table style="width:100%; border-collapse:collapse; font-size:14px; color:#374151;">
					<tr>
						<td style="padding:6px 0; color:#6b7280; width:40%;">Account</td>
						<td style="padding:6px 0;">${this.esc(account.email)}</td>
					</tr>
					<tr>
						<td style="padding:6px 0; color:#6b7280;">Time</td>
						<td style="padding:6px 0;">${time}</td>
					</tr>
				</table>
			</div>
			<div style="background:#fef2f2; border:1px solid #fecaca; border-radius:12px; padding:16px 20px;">
				<p style="margin:0; color:#991b1b; font-size:14px;">🚨 If this wasn't you, please contact us immediately at <a href="mailto:support@webster.com" style="color:#991b1b;">support@webster.com</a>.</p>
			</div>
			`
		);

		try {
			await this.transporter.sendMail({
				from: this.from,
				to: account.email,
				subject: "Failed email verification attempt on your webster account",
				html
			});
		} catch (err) {
			this.log.error("MAIL", "emailVerificationFailed", 500, err.message, err.stack);
		}
	}

	async sendProjectInvite(
		inviterName: string,
		projectName: string,
		inviteeEmail: string,
		token: string,
	): Promise<void> {
		const inviteUrl = `${this.config.get("FRONTEND_URL") ?? "#"}/projects/invite/${token}`;
		const html = this.wrap(
			`You've been invited to ${projectName}`,
			`
			<div style="text-align:center; padding: 8px 0 24px;">
				<div style="font-size:52px; margin-bottom:8px;">📨</div>
				<h1 style="margin:0 0 8px; color:#1e1b4b; font-size:24px;">You're invited!</h1>
				<p style="color:#6b7280; margin:0; font-size:15px;">
					<strong>${this.esc(inviterName)}</strong> has invited you to join the project
					<strong>${this.esc(projectName)}</strong> on webster.
				</p>
			</div>
			<div style="background:#f5f3ff; border-radius:12px; padding:20px 24px; margin-bottom:24px;">
				<p style="margin:0; color:#4f46e5; font-size:14px; font-weight:600;">📋 Project</p>
				<p style="margin:8px 0 0; color:#374151; font-size:15px; font-weight:700;">${this.esc(projectName)}</p>
			</div>
			<div style="text-align:center; margin-bottom:24px;">
				<a href="${inviteUrl}" style="display:inline-block; background:#4f46e5; color:#fff; text-decoration:none; padding:14px 36px; border-radius:8px; font-size:15px; font-weight:600;">Accept Invitation →</a>
			</div>
			<div style="background:#fefce8; border:1px solid #fde68a; border-radius:12px; padding:14px 20px; text-align:center;">
				<p style="margin:0; color:#92400e; font-size:13px;">⏱ This invitation expires in <strong>24 hours</strong>.</p>
			</div>
			<div style="margin-top:20px; background:#f9fafb; border-radius:12px; padding:14px 20px;">
				<p style="margin:0; color:#6b7280; font-size:13px;">If you didn't expect this invitation, you can safely ignore this email.</p>
			</div>
			`
		);

		try {
			await this.transporter.sendMail({
				from: this.from,
				to: inviteeEmail,
				subject: `${inviterName} invited you to "${projectName}" on webster`,
				html,
			});
		} catch (err) {
			this.log.error("MAIL", "sendProjectInvite", 500, err.message, err.stack);
		}
	}

	private wrap(title: string, content: string): string {
		return `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8"/>
			<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
			<title>${this.esc(title)}</title>
		</head>
		<body style="margin:0; padding:0; background:#f3f4f6; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
			<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6; padding:40px 16px;">
				<tr>
					<td align="center">
						<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
							<!-- Header -->
							<tr>
								<td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%); border-radius:16px 16px 0 0; padding:28px 32px 24px; text-align:center;">
									<span style="color:#fff; font-size:22px; font-weight:800; letter-spacing:-0.5px;">webster</span>
								</td>
							</tr>
							<!-- Body -->
							<tr>
								<td style="background:#ffffff; padding:32px; border-radius:0 0 16px 16px; box-shadow:0 4px 24px rgba(0,0,0,0.07);">
									${content}
								</td>
							</tr>
							<!-- Footer -->
							<tr>
								<td style="padding:20px 0 0; text-align:center;">
									<p style="margin:0; color:#9ca3af; font-size:12px;">© ${new Date().getFullYear()} webster. All rights reserved.</p>
								</td>
							</tr>
						</table>
					</td>
				</tr>
			</table>
		</body>
		</html>
		`;
	}

	private esc(str: string): string {
		return str
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");
	}
}
