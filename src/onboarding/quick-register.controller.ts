import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { QuickRegisterService } from './quick-register.service';

interface QuickRegisterDto {
  name: string;
  rootPath: string;
}

@ApiTags('Projects')
@Controller('projects')
export class QuickRegisterController {
  constructor(private readonly quickRegisterService: QuickRegisterService) {}

  // 상위 폴더 아래에서 아직 등록 안 된 git 저장소 후보를 찾아 보여준다 (자동 등록은 하지 않음).
  // 경로를 2단계(discover/scan)로 둔 이유: ProjectController의 GET /projects/:id 라우트가
  // 모듈 등록 순서상 먼저 매칭되므로, /projects/discover 처럼 한 단계짜리 경로는 그 :id에
  // 가로채인다. 두 단계 경로는 :id 패턴과 겹치지 않아 이 문제를 피할 수 있다.
  @Get('discover/scan')
  discover(@Query('root') root?: string) {
    if (!root) {
      throw new BadRequestException('root 쿼리 파라미터가 필요합니다.');
    }
    return this.quickRegisterService.discover(root);
  }

  // 프로젝트 등록 + git-collector 커넥터 등록 + 초기 동기화 + 세션 재계산을 한 번에 처리한다.
  @Post('quick-register')
  quickRegister(@Body() dto: QuickRegisterDto) {
    if (!dto.name || !dto.rootPath) {
      throw new BadRequestException('name과 rootPath는 필수입니다.');
    }
    return this.quickRegisterService.registerAndSync(dto.name, dto.rootPath);
  }
}
