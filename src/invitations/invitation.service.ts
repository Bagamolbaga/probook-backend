/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  InternalServerErrorException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import * as argon2 from 'argon2';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { Company } from '../companies/schema/company.schema';
import { EmailService } from '../email/email.service';
import { MembershipService } from '../memberships/membership.service';
import { CompanyRole } from '../memberships/schema/company-membership.schema';
import { SpecialistService } from '../specialists/specialist.service';
import { RealtimeService } from '../notification/realtime.service';
import { UserAccountStatus } from '../user/schema/user.schema';
import { UserService } from '../user/user.service';
import { CreateInvitationDto } from './dto/invitation.dto';
import {
  CompanyInvitation,
  CompanyInvitationDocument,
  InvitationDeliveryStatus,
  InvitationStatus,
} from './schema/company-invitation.schema';

@Injectable()
export class InvitationService {
  constructor(
    @InjectModel(CompanyInvitation.name)
    private readonly invitations: Model<CompanyInvitation>,
    @InjectModel(Company.name) private readonly companies: Model<Company>,
    private readonly users: UserService,
    private readonly memberships: MembershipService,
    private readonly specialists: SpecialistService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    @InjectConnection() private readonly connection: Connection,
    private readonly realtime: RealtimeService,
  ) {}

  async create(
    companyId: string,
    invitedByUserId: string,
    dto: CreateInvitationDto,
  ) {
    const companyObjectId = new Types.ObjectId(companyId);
    const company = await this.companies.findById(companyObjectId).lean();
    if (!company) throw new NotFoundException('Company not found');
    const email = dto.email.trim().toLowerCase();
    if (
      dto.roles?.length &&
      (dto.roles.length !== 1 || dto.roles[0] !== CompanyRole.SPECIALIST)
    ) {
      throw new BadRequestException(
        'Employee invitations may grant only the SPECIALIST role',
      );
    }
    const pending = await this.invitations.findOne({
      companyId: companyObjectId,
      email,
      status: InvitationStatus.PENDING,
    });
    if (pending && pending.expiresAt > new Date())
      throw new ConflictException('Pending invitation already exists');
    const token = randomBytes(32).toString('base64url');
    const invitation = await this.invitations.create({
      companyId: companyObjectId,
      invitedByUserId: new Types.ObjectId(invitedByUserId),
      email,
      firstName: dto.specialistProfile.firstName.trim(),
      lastName: dto.specialistProfile.lastName.trim(),
      specialistProfile: dto.specialistProfile,
      roles: [CompanyRole.SPECIALIST],
      tokenHash: this.hash(token),
      tokenCiphertext: this.encryptToken(token),
      expiresAt: this.createExpiry(),
    });
    return this.deliver(invitation, token, company.name);
  }

  async list(companyId: string) {
    await this.expirePending(companyId);
    const invitations = await this.invitations
      .find({ companyId: new Types.ObjectId(companyId) })
      .select('+tokenCiphertext')
      .sort({ createdAt: -1 });
    const company = await this.companies
      .findById(new Types.ObjectId(companyId))
      .select('name')
      .lean();
    return invitations.map((invitation) =>
      this.serializeInvitation(invitation, company?.name || null, true),
    );
  }

  async preview(token: string) {
    const invitation = await this.getValid(token);
    const company = await this.companies
      .findById(invitation.companyId)
      .select('name logo')
      .lean();
    const existing = await this.users.getUserForAuth({
      email: invitation.email,
    });
    const passwordSetupAvailable =
      !existing || existing.accountStatus === UserAccountStatus.UNCLAIMED;
    return {
      companyId: invitation.companyId.toString(),
      companyName: company?.name || null,
      companyLogo: company?.logo || null,
      email: invitation.email,
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      roles: invitation.roles,
      expiresAt: invitation.expiresAt,
      requiresAuthentication: !passwordSetupAvailable,
      passwordSetupAvailable,
    };
  }

  async accept(token: string, userId: string) {
    const invitation = await this.getValid(token);
    const user = await this.users.getUserBy({ id: userId });
    if (!user || user.email.toLowerCase() !== invitation.email)
      throw new ForbiddenException('Invitation belongs to another email');
    return this.activate(invitation, userId);
  }

  async registerPassword(token: string, password: string) {
    const invitation = await this.getValid(token);
    const passwordHash = await argon2.hash(password);
    const session = await this.connection.startSession();
    let user: Awaited<ReturnType<UserService['getUserForAuth']>>;
    let specialistProfileId: Types.ObjectId | null = null;
    try {
      await session.withTransaction(async () => {
        user = await this.users.getUserForAuth(
          { email: invitation.email },
          session,
        );
        if (user && user.accountStatus !== UserAccountStatus.UNCLAIMED) {
          throw new ConflictException(
            'Account already exists; sign in and accept the invitation',
          );
        }
        if (!user) {
          user = await this.users.createPasswordUser(
            {
              email: invitation.email,
              firstName: invitation.firstName,
              lastName: invitation.lastName,
              passwordHash,
              emailVerified: false,
            },
            session,
          );
        } else {
          user = await this.users.claimWithPassword(
            user._id,
            passwordHash,
            { firstName: invitation.firstName, lastName: invitation.lastName },
            session,
          );
        }
        if (!user) throw new BadRequestException('Unable to claim account');
        specialistProfileId = await this.activateInTransaction(
          invitation,
          user._id.toString(),
          session,
        );
      });
    } finally {
      await session.endSession();
    }
    if (specialistProfileId) {
      await this.realtime.addUserToCompany(
        user._id.toString(),
        invitation.companyId.toString(),
      );
      this.realtime.publishCompanyDataUpdated(
        invitation.companyId.toString(),
        'specialists',
      );
    }

    return user;
  }

  async resend(companyId: string, invitationId: string) {
    const companyObjectId = new Types.ObjectId(companyId);
    const invitationObjectId = new Types.ObjectId(invitationId);
    const invitation = await this.invitations
      .findOne({ _id: invitationObjectId, companyId: companyObjectId })
      .select('+tokenHash +tokenCiphertext');
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (
      invitation.status === InvitationStatus.ACCEPTED ||
      invitation.status === InvitationStatus.REVOKED
    ) {
      throw new ConflictException('Invitation is not pending');
    }
    const company = await this.companies.findById(companyObjectId).lean();
    const token = randomBytes(32).toString('base64url');
    invitation.tokenHash = this.hash(token);
    invitation.tokenCiphertext = this.encryptToken(token);
    invitation.expiresAt = this.createExpiry();
    invitation.status = InvitationStatus.PENDING;
    await invitation.save();
    return this.deliver(invitation, token, company?.name || 'ProBook');
  }

  async revoke(companyId: string, invitationId: string) {
    const companyObjectId = new Types.ObjectId(companyId);
    const invitationObjectId = new Types.ObjectId(invitationId);
    const existing = await this.invitations.findOne({
      _id: invitationObjectId,
      companyId: companyObjectId,
    });
    if (!existing) throw new NotFoundException('Invitation not found');
    if (existing.status !== InvitationStatus.PENDING) {
      throw new ConflictException('Invitation is not pending');
    }
    return this.invitations.findOneAndUpdate(
      {
        _id: invitationObjectId,
        companyId: companyObjectId,
        status: InvitationStatus.PENDING,
      },
      { $set: { status: InvitationStatus.REVOKED } },
      { new: true },
    );
  }

  private async activate(invitation: CompanyInvitation, userId: string) {
    const session = await this.connection.startSession();
    let specialistProfileId: Types.ObjectId | null = null;
    try {
      await session.withTransaction(async () => {
        specialistProfileId = await this.activateInTransaction(
          invitation,
          userId,
          session,
        );
      });
    } finally {
      await session.endSession();
    }
    if (specialistProfileId) {
      await this.realtime.addUserToCompany(
        userId,
        invitation.companyId.toString(),
      );
      this.realtime.publishCompanyDataUpdated(
        invitation.companyId.toString(),
        'specialists',
      );
    }
    return {
      membership: await this.memberships
        .findActive(userId, invitation.companyId)
        .then((items) => items[0]),
      specialistProfileId,
    };
  }

  private async activateInTransaction(
    invitation: CompanyInvitation,
    userId: string,
    session: ClientSession,
  ) {
    const claimed = await this.invitations.findOneAndUpdate(
      {
        _id: invitation._id,
        status: InvitationStatus.PENDING,
        expiresAt: { $gt: new Date() },
      },
      {
        $set: {
          status: InvitationStatus.ACCEPTED,
          acceptedByUserId: new Types.ObjectId(userId),
          acceptedAt: new Date(),
        },
      },
      { new: true, session },
    );
    if (!claimed) throw new ConflictException('Invitation was already used');

    for (const role of invitation.roles) {
      await this.memberships.upsertRole(
        userId,
        invitation.companyId,
        role,
        session,
      );
    }

    if (!invitation.roles.includes(CompanyRole.SPECIALIST)) return null;

    const draft = invitation.specialistProfile;
    const profile = await this.specialists.createSpecialist(
      {
        userId,
        company: invitation.companyId,
        bio: draft.bio,
        specialties: draft.specialties,
        services: draft.serviceIds?.map((id) => new Types.ObjectId(id)),
        defaultShift: draft.defaultShiftId
          ? new Types.ObjectId(draft.defaultShiftId)
          : undefined,
      },
      session,
    );
    return profile._id;
  }

  private async getValid(token: string) {
    const invitation = await this.invitations
      .findOne({ tokenHash: this.hash(token) })
      .select('+tokenHash');
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new ConflictException('Invitation was already accepted');
    }
    if (
      invitation.status === InvitationStatus.REVOKED ||
      invitation.status === InvitationStatus.EXPIRED
    ) {
      throw new GoneException('Invitation is no longer valid');
    }
    if (invitation.expiresAt <= new Date()) {
      invitation.status = InvitationStatus.EXPIRED;
      await invitation.save();
      throw new GoneException('Invitation expired');
    }
    return invitation;
  }

  private async deliver(
    invitation: CompanyInvitationDocument,
    token: string,
    companyName: string,
  ) {
    const inviteUrl = this.getInviteUrl(token);
    const delivery = await this.email.sendInvitation(
      invitation.email,
      inviteUrl,
      companyName,
    );
    invitation.deliveryStatus = InvitationDeliveryStatus[delivery.status];
    invitation.deliveryError = delivery.error;
    invitation.lastSentAt = new Date();
    invitation.sendAttempts += 1;
    await invitation.save();
    return {
      invitation: this.serializeInvitation(invitation, companyName),
      inviteUrl,
    };
  }

  private serializeInvitation(
    invitation: CompanyInvitationDocument,
    companyName: string | null,
    includeInviteUrl = false,
  ) {
    const { _id, __v, tokenHash, tokenCiphertext, ...value } =
      invitation.toObject();

    const result = {
      ...value,
      id: invitation._id.toString(),
      companyName,
    };

    if (
      includeInviteUrl &&
      value.status === InvitationStatus.PENDING &&
      tokenCiphertext
    ) {
      return {
        ...result,
        inviteUrl: this.getInviteUrl(this.decryptToken(tokenCiphertext)),
      };
    }

    return result;
  }

  private expirePending(companyId: string) {
    return this.invitations.updateMany(
      {
        companyId: new Types.ObjectId(companyId),
        status: InvitationStatus.PENDING,
        expiresAt: { $lte: new Date() },
      },
      { $set: { status: InvitationStatus.EXPIRED } },
    );
  }
  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private getInviteUrl(token: string) {
    const frontendUrl =
      this.config.get<string>('frontendUrl') || 'http://localhost:3000';
    return `${frontendUrl.replace(/\/$/, '')}/invitations/${token}`;
  }

  private getInvitationTokenKey() {
    const secret = this.config.get<string>('auth.secret');
    if (!secret) {
      throw new InternalServerErrorException(
        'Invitation token encryption is not configured',
      );
    }
    return createHash('sha256').update(secret).digest();
  }

  private encryptToken(token: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv(
      'aes-256-gcm',
      this.getInvitationTokenKey(),
      iv,
    );
    const ciphertext = Buffer.concat([
      cipher.update(token, 'utf8'),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
      'base64url',
    );
  }

  private decryptToken(tokenCiphertext: string) {
    const encrypted = Buffer.from(tokenCiphertext, 'base64url');
    const iv = encrypted.subarray(0, 12);
    const authTag = encrypted.subarray(12, 28);
    const ciphertext = encrypted.subarray(28);
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.getInvitationTokenKey(),
      iv,
    );
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  }

  private createExpiry() {
    const ttlHours = this.config.get<number>('invitation.ttlHours') || 168;
    return new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  }
}
