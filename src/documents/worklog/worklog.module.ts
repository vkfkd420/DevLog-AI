import { Module } from '@nestjs/common';
import { DocumentModule } from '../document.module';
import { LlmModule } from '../../llm/llm.module';
import { WorklogController } from './worklog.controller';
import { WorklogGeneratorService } from './worklog-generator.service';
import { WorklogContextBuilder } from './worklog-context.builder';

@Module({
  imports: [DocumentModule, LlmModule],
  controllers: [WorklogController],
  providers: [WorklogGeneratorService, WorklogContextBuilder],
  exports: [WorklogGeneratorService],
})
export class WorklogModule {}
