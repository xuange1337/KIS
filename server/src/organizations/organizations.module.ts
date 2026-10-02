import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './organization.entity';
import { OrganizationMember } from './organization-member.entity';
import { OrganizationInvitation } from './organization-invitation.entity';
import { MembershipsService } from './memberships.service';
import { OrganizationsService } from './organizations.service';
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
    ]),
  ],
  controllers: [OrganizationsController, InvitationsController],
  providers: [MembershipsService, OrganizationsService],
  exports: [MembershipsService, OrganizationsService, TypeOrmModule],
})
export class OrganizationsModule {}
