import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReportGeneratorService } from './report-generator.service';

interface GenerateReportDto {
  projectId: string;
  /** YYYY-MM-DD */
  periodStart: string;
  /** YYYY-MM-DD (포함) */
  periodEnd: string;
}

@ApiTags('Report')
@Controller('documents/report')
export class ReportController {
  constructor(private readonly reportGeneratorService: ReportGeneratorService) {}

  @Post()
  generate(@Body() dto: GenerateReportDto) {
    if (!dto.projectId) {
      throw new BadRequestException('projectId는 필수 값입니다.');
    }
    if (!dto.periodStart || !dto.periodEnd) {
      throw new BadRequestException('periodStart/periodEnd는 필수 값입니다 (YYYY-MM-DD).');
    }
    return this.reportGeneratorService.generate(dto.projectId, dto.periodStart, dto.periodEnd);
  }
}
