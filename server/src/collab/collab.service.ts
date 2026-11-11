import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ChecklistProgress } from '@crm/shared';
import { Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { canSeeAll } from '../common/helpers/owner-scope';
import { NotificationsService } from '../notifications/notifications.service';
import { ChecklistItem } from './checklist-item.entity';
import { Comment } from './comment.entity';
import { RecordAccessService, RecordType } from './record-access.service';

const MAX_ITEMS_PER_RECORD = 50;

@Injectable()
export class CollabService {
  constructor(
    @InjectRepository(Comment) private readonly comments: Repository<Comment>,
    @InjectRepository(ChecklistItem)
    private readonly items: Repository<ChecklistItem>,
    private readonly access: RecordAccessService,
    private readonly notifications: NotificationsService,
  ) {}

  /* ---------------------------- Комментарии ---------------------------- */

  async listComments(type: RecordType, id: number, user: AuthUser) {
    await this.access.assertVisible(type, id, user);
    const rows = await this.comments.query(
      `SELECT c.comment_id AS "commentId", c.body, c.created_at AS "createdAt",
              c.author_user_id AS "authorUserId", u.full_name AS "authorName"
         FROM comments c LEFT JOIN users u ON u.user_id = c.author_user_id
        WHERE c.organization_id = $1 AND c.entity_type = $2 AND c.entity_id = $3
        ORDER BY c.created_at DESC, c.comment_id DESC`,
      [user.organizationId, type, id],
    );
    return rows;
  }

  async addComment(type: RecordType, id: number, body: string, user: AuthUser) {
    const record = await this.access.assertVisible(type, id, user);
    const text = body.trim();
    if (!text) throw new BadRequestException('Комментарий пуст');
    const saved = await this.comments.save(
      this.comments.create({
        organizationId: user.organizationId,
        entityType: type,
        entityId: id,
        authorUserId: user.userId,
        body: text,
      }),
    );
    // Ответственный узнаёт о комментарии коллеги, свои комментарии не шумят
    if (record.ownerUserId && record.ownerUserId !== user.userId)
      await this.notifications.notify({
        organizationId: user.organizationId,
        userId: record.ownerUserId,
        type: 'comment',
        title: `${user.fullName}: новый комментарий`,
        body: `${record.title} — ${text}`,
        link: record.link,
        dedupeKey: `comment:${saved.commentId}`,
      });
    return {
      commentId: saved.commentId,
      body: saved.body,
      createdAt: saved.createdAt,
      authorUserId: user.userId,
      authorName: user.fullName,
    };
  }

  async removeComment(commentId: number, user: AuthUser) {
    const comment = await this.comments.findOneBy({
      commentId,
      organizationId: user.organizationId,
    });
    if (!comment) throw new NotFoundException('Комментарий не найден');
    // Удаляет автор или руководитель: чужую переписку менеджер не трёт
    if (comment.authorUserId !== user.userId && !canSeeAll(user))
      throw new ForbiddenException('Удалить можно только свой комментарий');
    await this.comments.delete({ commentId });
    return { success: true };
  }

  /* ----------------------------- Чек-листы ----------------------------- */

  async listItems(type: RecordType, id: number, user: AuthUser) {
    await this.access.assertVisible(type, id, user);
    return this.items.find({
      where: {
        organizationId: user.organizationId,
        entityType: type,
        entityId: id,
      },
      order: { position: 'ASC', itemId: 'ASC' },
    });
  }

  async addItem(type: RecordType, id: number, text: string, user: AuthUser) {
    await this.access.assertVisible(type, id, user);
    const clean = text.trim();
    if (!clean) throw new BadRequestException('Текст пункта пуст');
    const where = {
      organizationId: user.organizationId,
      entityType: type,
      entityId: id,
    };
    const count = await this.items.countBy(where);
    if (count >= MAX_ITEMS_PER_RECORD)
      throw new BadRequestException(
        `В чек-листе не больше ${MAX_ITEMS_PER_RECORD} пунктов`,
      );
    const last = await this.items.findOne({
      where,
      order: { position: 'DESC' },
    });
    return this.items.save(
      this.items.create({
        ...where,
        text: clean,
        position: (last?.position ?? 0) + 1,
      }),
    );
  }

  async updateItem(
    itemId: number,
    changes: { text?: string; isDone?: boolean },
    user: AuthUser,
  ) {
    const item = await this.loadItem(itemId, user);
    if (changes.text !== undefined) {
      const clean = changes.text.trim();
      if (!clean) throw new BadRequestException('Текст пункта пуст');
      item.text = clean;
    }
    if (changes.isDone !== undefined && changes.isDone !== item.isDone) {
      item.isDone = changes.isDone;
      item.doneAt = changes.isDone ? new Date() : null;
    }
    return this.items.save(item);
  }

  async removeItem(itemId: number, user: AuthUser) {
    const item = await this.loadItem(itemId, user);
    await this.items.delete({ itemId: item.itemId });
    return { success: true };
  }

  /** Ход выполнения: «3 из 5» для строки списка и карточки. */
  async progress(
    type: RecordType,
    id: number,
    user: AuthUser,
  ): Promise<ChecklistProgress> {
    const items = await this.listItems(type, id, user);
    return {
      total: items.length,
      done: items.filter((item) => item.isDone).length,
    };
  }

  private async loadItem(itemId: number, user: AuthUser) {
    const item = await this.items.findOneBy({
      itemId,
      organizationId: user.organizationId,
    });
    if (!item) throw new NotFoundException('Пункт не найден');
    // Права на пункт — это права на запись, к которой он относится
    await this.access.assertVisible(
      item.entityType as RecordType,
      item.entityId,
      user,
    );
    return item;
  }
}
