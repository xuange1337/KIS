import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DealStage, PipelineDto } from '@crm/shared';
import { DataSource, EntityManager } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Pipeline } from './pipeline.entity';
import { PipelineStage } from './pipeline-stage.entity';
import { CreatePipelineDto, UpdatePipelineDto } from './pipelines.dto';

const WORK_STAGES: DealStage[] = [
  DealStage.NEW,
  DealStage.QUALIFICATION,
  DealStage.PROPOSAL,
  DealStage.NEGOTIATION,
];
const TERMINAL: DealStage[] = [DealStage.WON, DealStage.LOST];

@Injectable()
export class PipelinesService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Основная воронка организации; создаётся при первом обращении. */
  async ensureDefault(
    organizationId: number,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<Pipeline> {
    const found = await manager.findOneBy(Pipeline, {
      organizationId,
      isDefault: true,
    });
    if (found) return found;
    const pipeline = await manager.save(
      manager.create(Pipeline, {
        organizationId,
        name: 'Основная воронка',
        isDefault: true,
      }),
    );
    await this.writeStages(manager, pipeline.pipelineId, [...WORK_STAGES]);
    return pipeline;
  }

  async list(user: AuthUser): Promise<PipelineDto[]> {
    await this.ensureDefault(user.organizationId);
    const pipelines = await this.dataSource.query(
      `SELECT p.pipeline_id AS "pipelineId", p.name, p.is_default AS "isDefault",
              (SELECT count(*)::int FROM deals d
                WHERE d.organization_id = p.organization_id
                  AND (d.pipeline_id = p.pipeline_id
                       OR (p.is_default AND d.pipeline_id IS NULL))) AS "dealsCount"
         FROM pipelines p WHERE p.organization_id = $1
        ORDER BY p.is_default DESC, lower(p.name)`,
      [user.organizationId],
    );
    const stages: Array<{ pipelineId: number; stage: DealStage }> =
      await this.dataSource.query(
        `SELECT ps.pipeline_id AS "pipelineId", ps.stage
           FROM pipeline_stages ps JOIN pipelines p ON p.pipeline_id = ps.pipeline_id
          WHERE p.organization_id = $1 ORDER BY ps.position`,
        [user.organizationId],
      );
    return pipelines.map((p: Omit<PipelineDto, 'stages'>) => ({
      ...p,
      stages: stages
        .filter((s) => s.pipelineId === p.pipelineId)
        .map((s) => s.stage),
    }));
  }

  async create(dto: CreatePipelineDto, user: AuthUser): Promise<PipelineDto> {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Название не может быть пустым');
    const stages = this.cleanStages(dto.stages);
    await this.assertNameFree(name, user.organizationId);
    await this.ensureDefault(user.organizationId);
    const created = await this.dataSource.transaction(async (manager) => {
      const pipeline = await manager.save(
        manager.create(Pipeline, {
          organizationId: user.organizationId,
          name,
          isDefault: false,
        }),
      );
      await this.writeStages(manager, pipeline.pipelineId, stages);
      return pipeline;
    });
    return this.one(created.pipelineId, user);
  }

  async update(
    id: number,
    dto: UpdatePipelineDto,
    user: AuthUser,
  ): Promise<PipelineDto> {
    await this.dataSource.transaction(async (manager) => {
      const pipeline = await manager.findOne(Pipeline, {
        where: { pipelineId: id, organizationId: user.organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!pipeline) throw new NotFoundException('Воронка не найдена');
      if (dto.name !== undefined) {
        const name = dto.name.trim();
        if (!name)
          throw new BadRequestException('Название не может быть пустым');
        if (name.toLowerCase() !== pipeline.name.toLowerCase())
          await this.assertNameFree(name, user.organizationId);
        pipeline.name = name;
      }
      if (dto.stages) {
        const stages = this.cleanStages(dto.stages);
        const used: Array<{ stage: DealStage }> = await manager.query(
          `SELECT DISTINCT stage FROM deals
            WHERE organization_id = $1
              AND (pipeline_id = $2 OR ($3 AND pipeline_id IS NULL))`,
          [user.organizationId, id, pipeline.isDefault],
        );
        const dropped = used
          .map((row) => row.stage)
          .filter(
            (stage) => !TERMINAL.includes(stage) && !stages.includes(stage),
          );
        if (dropped.length)
          throw new ConflictException(
            'В воронке есть сделки на убираемых стадиях. Сначала переведите их',
          );
        await manager.delete(PipelineStage, { pipelineId: id });
        await this.writeStages(manager, id, stages);
      }
      if (dto.isDefault === true && !pipeline.isDefault) {
        const previous = await manager.findOneBy(Pipeline, {
          organizationId: user.organizationId,
          isDefault: true,
        });
        // Сделки без воронки принадлежали прежней основной — закрепляем
        // за ней явно, иначе они перескочили бы вместе с новым признаком
        if (previous)
          await manager.query(
            `UPDATE deals SET pipeline_id = $1
              WHERE organization_id = $2 AND pipeline_id IS NULL`,
            [previous.pipelineId, user.organizationId],
          );
        await manager.update(
          Pipeline,
          { organizationId: user.organizationId, isDefault: true },
          { isDefault: false },
        );
        pipeline.isDefault = true;
      } else if (dto.isDefault === false && pipeline.isDefault) {
        throw new BadRequestException(
          'Основной воронкой станет другая: выберите её и отметьте основной',
        );
      }
      await manager.save(pipeline);
    });
    return this.one(id, user);
  }

  async remove(id: number, user: AuthUser): Promise<{ success: true }> {
    const pipeline = await this.dataSource.manager.findOneBy(Pipeline, {
      pipelineId: id,
      organizationId: user.organizationId,
    });
    if (!pipeline) throw new NotFoundException('Воронка не найдена');
    if (pipeline.isDefault)
      throw new BadRequestException('Основную воронку удалить нельзя');
    const [{ count }] = await this.dataSource.query(
      'SELECT count(*)::int AS count FROM deals WHERE pipeline_id = $1',
      [id],
    );
    if (count > 0)
      throw new ConflictException(
        'В воронке есть сделки: сначала перенесите их',
      );
    await this.dataSource.manager.delete(Pipeline, { pipelineId: id });
    return { success: true };
  }

  /** Стадии воронки сделки; сделка без воронки живёт в основной. */
  async stagesFor(
    pipelineId: number | null,
    organizationId: number,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<{ pipelineId: number; stages: DealStage[] }> {
    const id =
      pipelineId ??
      (await this.ensureDefault(organizationId, manager)).pipelineId;
    const rows: Array<{ stage: DealStage }> = await manager.query(
      `SELECT ps.stage FROM pipeline_stages ps
         JOIN pipelines p ON p.pipeline_id = ps.pipeline_id
        WHERE ps.pipeline_id = $1 AND p.organization_id = $2
        ORDER BY ps.position`,
      [id, organizationId],
    );
    if (!rows.length) throw new NotFoundException('Воронка не найдена');
    return { pipelineId: id, stages: rows.map((row) => row.stage) };
  }

  private async one(id: number, user: AuthUser): Promise<PipelineDto> {
    const all = await this.list(user);
    const found = all.find((p) => p.pipelineId === id);
    if (!found) throw new NotFoundException('Воронка не найдена');
    return found;
  }

  private cleanStages(input: DealStage[]): DealStage[] {
    const work = [...new Set(input)];
    if (work.some((stage) => !WORK_STAGES.includes(stage)))
      throw new BadRequestException(
        'Выиграна и Проиграна добавляются в воронку автоматически',
      );
    return work;
  }

  private async writeStages(
    manager: EntityManager,
    pipelineId: number,
    work: DealStage[],
  ): Promise<void> {
    const all = [...work, ...TERMINAL];
    await manager.insert(
      PipelineStage,
      all.map((stage, position) => ({ pipelineId, stage, position })),
    );
  }

  private async assertNameFree(name: string, organizationId: number) {
    const rows = await this.dataSource.query(
      'SELECT 1 FROM pipelines WHERE organization_id = $1 AND lower(name) = lower($2)',
      [organizationId, name],
    );
    if (rows.length)
      throw new ConflictException('Воронка с таким названием уже есть');
  }
}
