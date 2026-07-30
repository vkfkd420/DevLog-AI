import { Module } from '@nestjs/common';
import { DocumentModule } from '../document.module';
import { LlmModule } from '../../llm/llm.module';
import { WorklogModule } from '../worklog/worklog.module';
import { ReportController } from './report.controller';
import { ReportGeneratorService } from './report-generator.service';

@Module({
  imports: [DocumentModule, LlmModule, WorklogModule],
  controllers: [ReportController],
  providers: [ReportGeneratorService],
})
export class ReportModule {}
