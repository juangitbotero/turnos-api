import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { SUPPORT_EMAIL } from '@turnos/shared';

const BREVO_API = 'https://api.brevo.com/v3';

/**
 * Outgoing email — accountant data, wage reminders, ops alerts. Three modes,
 * picked at boot and reported by GET /api/health:
 *
 * 1. **Brevo HTTPS API** when BREVO_API_KEY is set. The production path:
 *    Railway blocks outbound SMTP below the Pro plan, so SMTP cannot work there
 *    (found 2026-10-05 — the connection simply times out). The sender address
 *    must be verified in Brevo (Senders & IPs).
 * 2. **SMTP** when MAIL_HOST + MAIL_USER are set — local dev, or a host that
 *    allows SMTP.
 * 3. **Log only** otherwise: every email is written to the log and dropped.
 *
 * MAIL_FROM defaults to `Turnos <MAIL_USER>`, else `Turnos <SUPPORT_EMAIL>`.
 */
@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter | null = null;
  private readonly brevoKey: string;
  private readonly logger = new Logger(MailService.name);
  private readonly from: string;

  /**
   * Reported by GET /api/health. `*-unverified` = configured, boot check not
   * finished; `brevo` / `smtp` = the provider accepted our credentials;
   * `*-error` = it refused them or could not be reached; `log-only` = nothing
   * configured.
   */
  status: 'log-only' | 'smtp-unverified' | 'smtp' | 'smtp-error'
    | 'brevo-unverified' | 'brevo' | 'brevo-error' = 'log-only';

  /** Where internal alerts go (disputes, justifications, no-show reviews). */
  readonly opsAddress: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('MAIL_HOST', '');
    const user = this.config.get<string>('MAIL_USER', '');
    const pass = this.config.get<string>('MAIL_PASS', '');
    this.brevoKey = this.config.get<string>('BREVO_API_KEY', '');
    this.from = this.config.get<string>('MAIL_FROM', user ? `Turnos <${user}>` : `Turnos <${SUPPORT_EMAIL}>`);
    this.opsAddress = this.config.get<string>('OPS_EMAIL', SUPPORT_EMAIL);

    if (this.brevoKey) {
      this.status = 'brevo-unverified';
      this.logger.log('Mail via Brevo HTTPS API');
      // Check the key once at boot, for the same reason as the SMTP login
      // below: a bad key would otherwise surface only as lost emails.
      fetch(`${BREVO_API}/account`, { headers: { 'api-key': this.brevoKey, accept: 'application/json' } })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          this.status = 'brevo';
          this.logger.log('Brevo API key verified');
        })
        .catch((err: Error) => {
          this.status = 'brevo-error';
          this.logger.error(`Brevo API key check failed — no email will be delivered: ${err.message}`);
        });
    } else if (host && user) {
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
    // No expiry line: the token does not expire (a new one replaces it when
    // the company asks for a resend). The old copy promised 24 hours.
    await this.sendBilingual(to, {
      pt: {
        subject: 'Verifique o seu email',
        html: `<p>Bem-vindo à Turnos!</p>
          <p>Clique no link abaixo para verificar o seu endereço de email:</p>
          <p><a href="${url}" style="color:#6a79ff;font-weight:bold;">Verificar email</a></p>`,
      },
      en: {
        subject: 'Verify your email',
        html: `<p>Welcome to Turnos!</p>
          <p>Click the link below to verify your email address:</p>
          <p><a href="${url}" style="color:#6a79ff;font-weight:bold;">Verify email</a></p>`,
      },
    });
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

  /**
   * One email carrying both languages: Portuguese first, then English under a
   * divider; subject "PT · EN". Interim measure (2026-10-05) for emails to
   * companies, whose language is not stored yet — the end state is sending
   * each recipient only their own language. Internal ops alerts stay PT-only.
   */
  async sendBilingual(
    to: string,
    copy: { pt: { subject: string; html: string }; en: { subject: string; html: string } },
  ): Promise<void> {
    const html = `<div lang="pt">${copy.pt.html}</div>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 20px">
      <p style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.5px;margin:0 0 8px">English</p>
      <div lang="en">${copy.en.html}</div>
      <p style="color:#9ca3af;font-size:12px;margin-top:28px">Turnos · ${SUPPORT_EMAIL}</p>`;
    await this.send(to, `${copy.pt.subject} · ${copy.en.subject} — Turnos`, html);
  }

  /** Generic send — used by compliance and other modules */
  async sendMail(opts: { to: string; subject: string; html: string }): Promise<void> {
    await this.send(opts.to, opts.subject, opts.html);
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (this.brevoKey) {
      const res = await fetch(`${BREVO_API}/smtp/email`, {
        method: 'POST',
        headers: { 'api-key': this.brevoKey, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: MailService.parseAddress(this.from),
          to: [{ email: to }],
          subject,
          htmlContent: html,
        }),
      });
      if (!res.ok) {
        // Thrown like a nodemailer failure, so callers' existing error
        // handling applies unchanged.
        throw new Error(`Brevo send failed (HTTP ${res.status}): ${await res.text()}`);
      }
      this.logger.log(`Email sent to ${to}: ${subject}`);
      return;
    }
    if (!this.transporter) {
      this.logger.debug(`[MOCK EMAIL] To: ${to} | Subject: ${subject}`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, to, subject, html });
    this.logger.log(`Email sent to ${to}: ${subject}`);
  }

  /** `Turnos <a@b.pt>` → { name: 'Turnos', email: 'a@b.pt' }; a bare address passes through. */
  private static parseAddress(from: string): { name?: string; email: string } {
    const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
    return m ? { name: m[1] || undefined, email: m[2] } : { email: from.trim() };
  }
}
