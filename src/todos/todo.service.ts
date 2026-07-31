import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Todo } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { QueryTodosDto } from './dto/query-todos.dto';

const VALID_PRIORITIES = ['high', 'normal', 'low'];

@Injectable()
export class TodoService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTodoDto): Promise<Todo> {
    if (!dto.projectId) {
      throw new BadRequestException('projectId는 필수 값입니다.');
    }
    if (!dto.title?.trim()) {
      throw new BadRequestException('title은 필수 값입니다.');
    }
    if (dto.priority && !VALID_PRIORITIES.includes(dto.priority)) {
      throw new BadRequestException('priority는 high | normal | low 중 하나여야 합니다.');
    }

    return this.prisma.todo.create({
      data: {
        projectId: dto.projectId,
        title: dto.title.trim(),
        priority: dto.priority ?? 'normal',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        source: dto.source ?? 'manual',
        sessionId: dto.sessionId,
        eventId: dto.eventId,
        documentId: dto.documentId,
      },
    });
  }

  /** projectId를 생략하면(전체 보기) 모든 프로젝트의 TODO를 가져온다. */
  async list(filter: QueryTodosDto): Promise<Todo[]> {
    return this.prisma.todo.findMany({
      where: {
        projectId: filter.projectId,
        completed: filter.completed === undefined ? undefined : filter.completed === 'true',
      },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  async update(id: string, dto: UpdateTodoDto): Promise<Todo> {
    if (dto.priority && !VALID_PRIORITIES.includes(dto.priority)) {
      throw new BadRequestException('priority는 high | normal | low 중 하나여야 합니다.');
    }
    const existing = await this.findOrThrow(id);

    const completingNow = dto.completed === true && !existing.completed;
    const reopening = dto.completed === false && existing.completed;

    return this.prisma.todo.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        priority: dto.priority,
        dueDate: dto.dueDate === undefined ? undefined : dto.dueDate === null ? null : new Date(dto.dueDate),
        completed: dto.completed,
        completedAt: completingNow ? new Date() : reopening ? null : undefined,
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOrThrow(id);
    await this.prisma.todo.delete({ where: { id } });
  }

  private async findOrThrow(id: string): Promise<Todo> {
    const todo = await this.prisma.todo.findUnique({ where: { id } });
    if (!todo) {
      throw new NotFoundException(`Todo(${id})를 찾을 수 없습니다.`);
    }
    return todo;
  }
}
