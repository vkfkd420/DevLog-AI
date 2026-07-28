import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConnectorService } from './connector.service';
import { RegisterConnectorDto } from './dto/register-connector.dto';
import { UpdateConnectorDto } from './dto/update-connector.dto';
import { QueryConnectorsDto } from './dto/query-connectors.dto';

@ApiTags('Connectors')
@Controller('connectors')
export class ConnectorController {
  constructor(private readonly connectorService: ConnectorService) {}

  @Post()
  register(@Body() dto: RegisterConnectorDto) {
    return this.connectorService.register(dto);
  }

  @Get()
  list(@Query() query: QueryConnectorsDto) {
    return this.connectorService.list(query);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.connectorService.getById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateConnectorDto) {
    return this.connectorService.update(id, dto);
  }
}
