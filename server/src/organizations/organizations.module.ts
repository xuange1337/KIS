import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './organization.entity';
import { OrganizationMember } from './organization-member.entity';
import { MembershipsService } from './memberships.service';

/**
 * Участия в организациях нужны и авторизации, и пользователям, и
 * будущим приглашениям, поэтому модуль глобальный: иначе каждый
 * потребитель импортировал бы его отдельно.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Organization, OrganizationMember])],
  providers: [MembershipsService],
  exports: [MembershipsService, TypeOrmModule],
})
export class OrganizationsModule {}
