import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WorklogGeneratorService } from './worklog-generator.service';

interface GenerateWorklogDto {
  projectId: string;
  /** YYYY-MM-DD */
  date: string;
}

@ApiTags('Worklog')
@Controller('documents/worklog')
export class WorklogController {
  constructor(private readonly worklogGeneratorService: WorklogGeneratorService) {}

  @Post()
  generate(@Body() dto: GenerateWorklogDto) {
    if (!dto.projectId) {
      throw new BadRequestException('projectId는 필수 값입니다.');
    }
    if (!dto.date) {
      throw new BadRequestException('date는 필수 값입니다 (YYYY-MM-DD).');
    }
    return this.worklogGeneratorService.generate(dto.projectId, dto.date);
  }
}
