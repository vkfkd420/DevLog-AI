import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TodoService } from './todo.service';
import { RecommendationService } from './recommendation.service';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { QueryTodosDto } from './dto/query-todos.dto';

@ApiTags('Todos')
@Controller('todos')
export class TodoController {
  constructor(
    private readonly todoService: TodoService,
    private readonly recommendationService: RecommendationService,
  ) {}

  // projectId를 생략하면(전체 보기) 모든 프로젝트를 대상으로 추천을 계산해 합쳐서 반환한다.
  @Get('recommendations')
  recommendations(@Query('projectId') projectId?: string) {
    return projectId ? this.recommendationService.forProject(projectId) : this.recommendationService.forAllProjects();
  }

  @Post()
  create(@Body() dto: CreateTodoDto) {
    return this.todoService.create(dto);
  }

  @Get()
  list(@Query() query: QueryTodosDto) {
    return this.todoService.list(query);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTodoDto) {
    return this.todoService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.todoService.remove(id);
    return { id, deleted: true };
  }
}
