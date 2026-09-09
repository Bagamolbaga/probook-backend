import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

export type EmailDeliveryResult = { status: 'SENT' | 'FAILED'; error?: string };

@Injectable()
export class EmailService {
  constructor(private readonly config: ConfigService) {}

  async sendInvitation(
    to: string,
    inviteUrl: string,
    companyName: string,
  ): Promise<EmailDeliveryResult> {
    const provider = this.config.get<string>('email.provider');
    const user = this.config.get<string>('email.gmailUser');
    const password = this.config.get<string>('email.gmailAppPassword');
    if (provider !== 'gmail' || !user || !password) {
      return { status: 'FAILED', error: 'Invitation email is not configured' };
    }
    try {
      const transport = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass: password },
      });
      await transport.sendMail({
        from: this.config.get<string>('email.from') || `ProBook <${user}>`,
        to,
        subject: `Invitation to ${companyName} in ProBook`,
        text: `You were invited to ${companyName}. Accept the invitation: ${inviteUrl}\nThe link expires in 7 days.`,
        html: `<p>You were invited to <strong>${this.escape(companyName)}</strong>.</p><p><a href="${inviteUrl}">Accept invitation</a></p><p>This link expires in 7 days.</p>`,
      });
      return { status: 'SENT' };
    } catch (error) {
      return {
        status: 'FAILED',
        error:
          error instanceof Error
            ? error.message.slice(0, 500)
            : 'Email delivery failed',
      };
    }
  }

  private escape(value: string) {
    return value.replace(
      /[&<>"']/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;',
        })[character],
    );
  }
}
