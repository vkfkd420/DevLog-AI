import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AiChatCollectorService } from './ai-chat-collector.service';
import { ReportChatExchangeDto } from './dto/report-chat-exchange.dto';

@ApiTags('AI-Chat Collector')
@Controller('ai-chat-collector')
export class AiChatCollectorController {
  constructor(private readonly aiChatCollectorService: AiChatCollectorService) {}

  @Post(':connectorId/exchange')
  reportExchange(@Param('connectorId') connectorId: string, @Body() dto: ReportChatExchangeDto) {
    return this.aiChatCollectorService.reportExchange(connectorId, dto);
  }
}
