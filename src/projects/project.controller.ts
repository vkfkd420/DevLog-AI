import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProjectService } from './project.service';
import { RegisterProjectDto } from './dto/register-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';

@ApiTags('Projects')
@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  register(@Body() dto: RegisterProjectDto) {
    return this.projectService.register(dto);
  }

  @Get()
  list(@Query() query: QueryProjectsDto) {
    return this.projectService.list(query);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.projectService.getById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.projectService.remove(id);
    return { id, deleted: true };
  }
}
