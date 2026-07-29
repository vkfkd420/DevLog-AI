import { BadRequestException, Injectable } from '@nestjs/common';
import { DocumentService } from '../document.service';
import { LlmGatewayService } from '../../llm/llm-gateway.service';
import { WorklogContextBuilder } from './worklog-context.builder';

const WORKLOG_MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `당신은 개발자의 업무일지를 작성하는 도우미입니다.
아래 제공되는 내용은 이 개발자가 실제로 수행한 활동의 Timeline 기록입니다.
반드시 제공된 데이터에 근거해서만 작성하고, 데이터에 없는 내용을 추측하거나 지어내지 마세요.
다음 형식의 JSON으로만 답하세요. 다른 설명이나 코드블록 표시 없이 순수 JSON만 출력하세요.
{"summary": "오늘 커밋/파일 편집/AI 대화 내용을 바탕으로 실제로 어떤 작업을 했는지 2~4문장으로 구체적으로 요약 (예: 어떤 기능을 추가/수정했고 왜 했는지). 커밋 메시지를 그대로 나열하지 말고 자연스러운 문장으로 풀어서 설명", "troubleshooting": "오늘 겪은 문제와 해결 과정을 한국어로 정리 (특별한 이슈가 없으면 빈 문자열)", "tomorrow": "기록을 바탕으로 다음에 이어서 하면 좋을 작업을 한 문장으로 제안 (근거가 부족하면 빈 문자열)"}`;

export interface GenerateWorklogResult {
  documentId: string;
  content: string;
  eventCount: number;
  sessionCount: number;
}

// 업무일지는 이제 마크다운 문자열이 아니라 카드 UI용 구조화 JSON을 content에 저장한다.
// commits/files/aiQuestions/errors는 Context Builder가 이미 센 결정론적 값이고,
// LLM은 troubleshooting/tomorrow 두 서술 필드만 생성한다 (Knowledge와 동일한 6단계 설계).
interface WorklogNarrative {
  summary?: string;
  troubleshooting?: string;
  tomorrow?: string;
}

@Injectable()
export class WorklogGeneratorService {
  constructor(
    private readonly documentService: DocumentService,
    private readonly contextBuilder: WorklogContextBuilder,
    private readonly llmGateway: LlmGatewayService,
  ) {}

  async generate(projectId: string, date: string): Promise<GenerateWorklogResult> {
    const { periodStart, periodEnd } = this.resolvePeriod(date);
    const context = await this.contextBuilder.build(projectId, periodStart, periodEnd);

    const document = await this.documentService.findOrCreateDraft({
      projectId,
      type: 'worklog',
      periodStart,
      periodEnd,
    });

    let narrative: WorklogNarrative;
    let sourceModel: string | undefined;

    if (context.eventCount === 0) {
      narrative = { summary: '', troubleshooting: '', tomorrow: '' };
    } else {
      const raw = await this.llmGateway.complete({
        model: WORKLOG_MODEL,
        system: SYSTEM_PROMPT,
        userContent: `## ${date} 활동 기록\n\n${context.promptContent}`,
      });
      narrative = this.tryParseJson(raw) ?? { summary: raw, troubleshooting: '', tomorrow: '' };
      sourceModel = WORKLOG_MODEL;
    }

    const content = JSON.stringify({
      commits: context.stats.commits,
      files: context.stats.files,
      aiQuestions: context.stats.aiQuestions,
      errors: context.stats.errors,
      summary: narrative.summary ?? '',
      troubleshooting: narrative.troubleshooting ?? '',
      tomorrow: narrative.tomorrow ?? '',
      note: '',
    });

    await this.documentService.addVersion(document.id, content, 'ai_generated', sourceModel);
    await this.documentService.addEvidence(document.id, context.eventIds);

    return {
      documentId: document.id,
      content,
      eventCount: context.eventCount,
      sessionCount: context.sessionCount,
    };
  }

  private resolvePeriod(date: string): { periodStart: Date; periodEnd: Date } {
    const periodStart = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(periodStart.getTime())) {
      throw new BadRequestException('date는 YYYY-MM-DD 형식이어야 합니다.');
    }
    const periodEnd = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000);
    return { periodStart, periodEnd };
  }

  private tryParseJson(raw: string): WorklogNarrative | null {
    try {
      const cleaned = raw.trim().replace(/^```json\s*|```\s*$/g, '');
      return JSON.parse(cleaned) as WorklogNarrative;
    } catch {
      return null;
    }
  }
}
