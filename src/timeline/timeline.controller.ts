import { Body, Controller, Get, HttpStatus, Param, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CreateEventDto } from './dto/create-event.dto';
import { QueryEventsDto } from './dto/query-events.dto';
import { TimelineService } from './timeline.service';

@ApiTags('Events')
@Controller('events')
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  @Post()
  async appendEvent(@Body() dto: CreateEventDto, @Res({ passthrough: true }) res: Response) {
    const { event, created } = await this.timelineService.appendEvent(dto);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return event;
  }

  @Get()
  queryEvents(@Query() query: QueryEventsDto) {
    return this.timelineService.queryEvents(query);
  }

  @Get(':id')
  getEvent(@Param('id') id: string) {
    return this.timelineService.getEventById(id);
  }
}
