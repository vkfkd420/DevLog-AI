import { Module } from '@nestjs/common';
import { ConnectorModule } from '../../connectors/connector.module';
import { TimelineModule } from '../../timeline/timeline.module';
import { AiChatCollectorController } from './ai-chat-collector.controller';
import { AiChatCollectorService } from './ai-chat-collector.service';

@Module({
  imports: [ConnectorModule, TimelineModule],
  controllers: [AiChatCollectorController],
  providers: [AiChatCollectorService],
})
export class AiChatCollectorModule {}
