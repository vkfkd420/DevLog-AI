import { Module } from '@nestjs/common';
import { TimelineController } from './timeline.controller';
import { TimelineService } from './timeline.service';
import { CorrelationController } from './correlation.controller';
import { CorrelationService } from './correlation.service';

@Module({
  controllers: [TimelineController, CorrelationController],
  providers: [TimelineService, CorrelationService],
  exports: [TimelineService],
})
export class TimelineModule {}
