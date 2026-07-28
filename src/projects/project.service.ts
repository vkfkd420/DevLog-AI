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
}
