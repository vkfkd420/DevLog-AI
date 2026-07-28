import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { KnowledgeService } from './knowledge.service';

interface GenerateKnowledgeDto {
  eventId: string;
}

@ApiTags('Knowledge')
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post('generate')
  generate(@Body() dto: GenerateKnowledgeDto) {
    if (!dto.eventId) {
      throw new BadRequestException('eventId는 필수 값입니다.');
    }
    return this.knowledgeService.generateFromEvent(dto.eventId);
  }

  @Get()
  list(@Query('projectId') projectId: string) {
    if (!projectId) {
      throw new BadRequestException('projectId는 필수 값입니다.');
    }
    return this.knowledgeService.list(projectId);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.knowledgeService.getById(id);
  }
}
