import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './organization.entity';
import { OrganizationMember } from './organization-member.entity';
import { OrganizationInvitation } from './organization-invitation.entity';
import { MembershipsService } from './memberships.service';
import { OrganizationsService } from './organizations.service';
import { TrialService } from './trial.service';
import { MembersService } from './members.service';
import { ClosureService } from './closure.service';
import { RefreshSession } from '../auth/refresh-session.entity';
import { User } from '../users/user.entity';
import {
  InvitationsController,
  OrganizationsController,
} from './organizations.controller';

/**
 * Участия в организациях нужны и авторизации, и пользователям, и
 * будущим приглашениям, поэтому модуль глобальный: иначе каждый
 * потребитель импортировал бы его отдельно.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      OrganizationMember,
      OrganizationInvitation,
      RefreshSession,
      User,
    ]),
  ],
  controllers: [OrganizationsController, InvitationsController],
  providers: [
    MembershipsService,
    OrganizationsService,
    TrialService,
    MembersService,
    ClosureService,
  ],
  exports: [
    MembershipsService,
    OrganizationsService,
    TrialService,
    TypeOrmModule,
  ],
})
export class OrganizationsModule {}
