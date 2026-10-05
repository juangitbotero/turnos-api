import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { SUPPORT_EMAIL } from '@turnos/shared';

/**
 * Outgoing email. Nothing is sent unless MAIL_HOST and MAIL_USER are set —
 * without them every email (accountant data, wage reminders, ops alerts) is
 * only written to the log. GET /api/health reports which mode is live.
 *
 * Beta setup with the Gmail account: MAIL_HOST=smtp.gmail.com, MAIL_PORT=587,
 * MAIL_USER=turnos.contact@gmail.com, MAIL_PASS=<Google app password>.
 * Gmail rewrites any other From address to the account's own, so MAIL_FROM
 * defaults to MAIL_USER.
 */
@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter | null = null;
  private readonly logger = new Logger(MailService.name);
  private readonly from: string;

  /**
   * Reported by GET /api/health. 'log-only' = no SMTP configured;
   * 'smtp-unverified' = configured, boot login not finished yet;
   * 'smtp' = the server accepted our login; 'smtp-error' = it refused it.
   */
  status: 'log-only' | 'smtp-unverified' | 'smtp' | 'smtp-error' = 'log-only';

  /** Where internal alerts go (disputes, justifications, no-show reviews). */
  readonly opsAddress: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('MAIL_HOST', '');
    const user = this.config.get<string>('MAIL_USER', '');
    const pass = this.config.get<string>('MAIL_PASS', '');
    this.from = this.config.get<string>('MAIL_FROM', user ? `Turnos <${user}>` : `Turnos <${SUPPORT_EMAIL}>`);
    this.opsAddress = this.config.get<string>('OPS_EMAIL', SUPPORT_EMAIL);

    if (host && user) {
      this.status = 'smtp-unverified';
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('MAIL_PORT', 587),
        secure: false,
        auth: { user, pass },
      });
      this.logger.log('Mail transporter initialized');
      // Log in to the SMTP server once at boot. Without this a wrong app
      // password is invisible until the first real email silently fails.
      this.transporter.verify()
        .then(() => {
          this.status = 'smtp';
          this.logger.log('SMTP login verified');
        })
        .catch((err: Error) => {
          this.status = 'smtp-error';
          this.logger.error(`SMTP login failed — no email will be delivered: ${err.message}`);
        });
    } else {
      this.logger.warn('MAIL_HOST/MAIL_USER not set — emails will be logged to console only');
    }
  }

  async sendEmployerVerification(to: string, token: string): Promise<void> {
    // Routes live under the global /api prefix; API_URL is the bare origin
    // (uploads are served from it at /uploads). Tolerate either form.
    const origin = this.config.get<string>('API_URL', 'http://localhost:3001').replace(/\/api\/?$/, '');
    const url = `${origin}/api/auth/verify-email/${token}`;
    await this.send(
      to,
      'Verifique o seu email — Turnos',
      `<p>Bem-vindo à Turnos!</p>
       <p>Clique no link abaixo para verificar o seu endereço de email:</p>
       <p><a href="${url}" style="color:#6a79ff;font-weight:bold;">Verificar email</a></p>
       <p>O link expira em 24 horas.</p>`,
    );
  }

  async sendWorkerApproved(to: string, name: string): Promise<void> {
    await this.send(
      to,
      'O seu perfil foi aprovado — Turnos',
      `<p>Olá ${name},</p>
       <p>O seu perfil foi aprovado! Já pode candidatar-se a turnos na app Turnos.</p>
       <p><strong>Recebe o valor bruto por inteiro</strong> — pago diretamente pela empresa após cada turno concluído, sem comissões.</p>`,
    );
  }

  async sendWorkerRejected(to: string, name: string, reason: string): Promise<void> {
    await this.send(
      to,
      'Atualização sobre o seu perfil — Turnos',
      `<p>Olá ${name},</p>
       <p>Infelizmente o seu perfil não foi aprovado neste momento.</p>
       <p>Motivo: ${reason}</p>
       <p>Por favor complete o seu perfil e submeta novamente.</p>`,
    );
  }

  /** Generic send — used by compliance and other modules */
  async sendMail(opts: { to: string; subject: string; html: string }): Promise<void> {
    await this.send(opts.to, opts.subject, opts.html);
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      this.logger.debug(`[MOCK EMAIL] To: ${to} | Subject: ${subject}`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, to, subject, html });
    this.logger.log(`Email sent to ${to}: ${subject}`);
  }
}
