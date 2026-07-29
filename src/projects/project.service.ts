import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Project } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { RegisterProjectDto } from './dto/register-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';

@Injectable()
export class ProjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  async register(dto: RegisterProjectDto): Promise<Project> {
    if (!dto.name) {
      throw new BadRequestException('name은 필수 값입니다.');
    }
    if (!dto.rootPath) {
      throw new BadRequestException('rootPath는 필수 값입니다.');
    }

    try {
      return await this.prisma.project.create({
        data: {
          name: dto.name,
          rootPath: dto.rootPath,
          workspaceId: this.workspaceService.getWorkspaceId(),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`이미 등록된 경로입니다: ${dto.rootPath}`);
      }
      throw error;
    }
  }

  async list(filter: QueryProjectsDto): Promise<Project[]> {
    return this.prisma.project.findMany({
      where: filter.includeArchived === 'true' ? {} : { archivedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getById(id: string): Promise<Project> {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project(${id})를 찾을 수 없습니다.`);
    }
    return project;
  }

  async update(id: string, dto: UpdateProjectDto): Promise<Project> {
    try {
      return await this.prisma.project.update({
        where: { id },
        data: {
          name: dto.name,
          archivedAt: dto.archived === undefined ? undefined : dto.archived ? new Date() : null,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`Project(${id})를 찾을 수 없습니다.`);
      }
      throw error;
    }
  }

  /**
   * 프로젝트와 그에 딸린 모든 데이터(이벤트/세션/커넥터/업무일지/Knowledge)를 완전히 삭제한다.
   * archive와 달리 되돌릴 수 없다 — FK 제약을 지키기 위해 자식 테이블부터 순서대로 지운다.
   */
  async remove(id: string): Promise<void> {
    await this.getById(id);

    const knowledgeEntries = await this.prisma.knowledgeEntry.findMany({ where: { projectId: id }, select: { id: true } });
    const knowledgeIds = knowledgeEntries.map((k) => k.id);
    if (knowledgeIds.length) {
      await this.prisma.knowledgeEventEvidence.deleteMany({ where: { knowledgeId: { in: knowledgeIds } } });
      await this.prisma.knowledgeDocumentEvidence.deleteMany({ where: { knowledgeId: { in: knowledgeIds } } });
      await this.prisma.knowledgeEntry.deleteMany({ where: { id: { in: knowledgeIds } } });
    }

    const documents = await this.prisma.document.findMany({ where: { projectId: id }, select: { id: true } });
    const documentIds = documents.map((d) => d.id);
    if (documentIds.length) {
      await this.prisma.documentEvidence.deleteMany({ where: { documentId: { in: documentIds } } });
      await this.prisma.documentVersion.deleteMany({ where: { documentId: { in: documentIds } } });
      await this.prisma.document.deleteMany({ where: { id: { in: documentIds } } });
    }

    const events = await this.prisma.event.findMany({ where: { projectId: id }, select: { id: true } });
    const eventIds = events.map((e) => e.id);
    if (eventIds.length) {
      await this.prisma.eventLink.deleteMany({
        where: { OR: [{ eventIdA: { in: eventIds } }, { eventIdB: { in: eventIds } }] },
      });
      await this.prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    }

    await this.prisma.session.deleteMany({ where: { projectId: id } });
    await this.prisma.connector.deleteMany({ where: { projectId: id } });
    await this.prisma.project.delete({ where: { id } });
  }
}
