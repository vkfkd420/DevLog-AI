import { BadRequestException, Injectable } from '@nestjs/common';
import { DocumentService } from '../document.service';
import { LlmGatewayService } from '../../llm/llm-gateway.service';
import { WorklogContextBuilder } from '../worklog/worklog-context.builder';

const REPORT_MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `당신은 개발자의 업무 보고서를 작성하는 도우미입니다.
아래 제공되는 내용은 지정된 기간 동안 이 개발자가 실제로 수행한 활동의 Timeline 기록입니다.
반드시 제공된 데이터에 근거해서만 작성하고, 데이터에 없는 내용을 추측하거나 지어내지 마세요.
날짜를 하나하나 나열하지 말고, 이 기간 동안의 작업을 응집력 있는 하나의 흐름으로 정리하세요.
다음 형식의 JSON으로만 답하세요. 다른 설명이나 코드블록 표시 없이 순수 JSON만 출력하세요.
{"summary": "이 기간 동안 실제로 어떤 작업을 했는지 프로젝트 관점에서 3~6문장으로 응집력 있게 요약 (어떤 기능/작업을 진행했고 왜 했는지, 날짜 나열이 아닌 흐름 있는 문단으로)", "troubleshooting": "이 기간 중 있었던 주요 문제와 해결 과정을 정리 (특별한 이슈가 없으면 빈 문자열)", "tomorrow": "기록을 바탕으로 다음 기간에 이어서 하면 좋을 작업을 한두 문장으로 제안 (근거가 부족하면 빈 문자열)"}`;

export interface GenerateReportResult {
  documentId: string;
  content: string;
  eventCount: number;
  sessionCount: number;
}

interface ReportNarrative {
  summary?: string;
  troubleshooting?: string;
  tomorrow?: string;
}

// 업무일지(하루 단위)와 같은 구조(JSON content, WorklogCard로 렌더링)를 재사용하되,
// 기간(periodStart~periodEnd)에 걸친 Timeline 전체를 컨텍스트로 넘겨 하나의 응집된 보고서로 요약한다.
// Retrieval(Context Builder)은 업무일지와 동일하게 재사용하고, 프롬프트만 "기간 보고서"용으로 다르게 준다.
@Injectable()
export class ReportGeneratorService {
  constructor(
    private readonly documentService: DocumentService,
    private readonly contextBuilder: WorklogContextBuilder,
    private readonly llmGateway: LlmGatewayService,
  ) {}

  async generate(projectId: string, periodStartStr: string, periodEndStr: string): Promise<GenerateReportResult> {
    const { periodStart, periodEnd } = this.resolvePeriod(periodStartStr, periodEndStr);
    const context = await this.contextBuilder.build(projectId, periodStart, periodEnd);

    const document = await this.documentService.findOrCreateDraft({
      projectId,
      type: 'report',
      periodStart,
      periodEnd,
    });

    let narrative: ReportNarrative;
    let sourceModel: string | undefined;

    if (context.eventCount === 0) {
      narrative = { summary: '', troubleshooting: '', tomorrow: '' };
    } else {
      const raw = await this.llmGateway.complete({
        model: REPORT_MODEL,
        system: SYSTEM_PROMPT,
        userContent: `## ${periodStartStr} ~ ${periodEndStr} 활동 기록\n\n${context.promptContent}`,
      });
      narrative = this.tryParseJson(raw) ?? { summary: raw, troubleshooting: '', tomorrow: '' };
      sourceModel = REPORT_MODEL;
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

  private resolvePeriod(periodStartStr: string, periodEndStr: string): { periodStart: Date; periodEnd: Date } {
    const periodStart = new Date(`${periodStartStr}T00:00:00.000Z`);
    const periodEndInclusive = new Date(`${periodEndStr}T00:00:00.000Z`);
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEndInclusive.getTime())) {
      throw new BadRequestException('periodStart/periodEnd는 YYYY-MM-DD 형식이어야 합니다.');
    }
    if (periodStart.getTime() > periodEndInclusive.getTime()) {
      throw new BadRequestException('periodStart는 periodEnd보다 이후일 수 없습니다.');
    }
    // periodEnd는 선택한 마지막 날의 다음날 00:00 (exclusive 상한) — 업무일지와 동일한 관례.
    const periodEnd = new Date(periodEndInclusive.getTime() + 24 * 60 * 60 * 1000);
    return { periodStart, periodEnd };
  }

  private tryParseJson(raw: string): ReportNarrative | null {
    try {
      const cleaned = raw.trim().replace(/^```json\s*|```\s*$/g, '');
      return JSON.parse(cleaned) as ReportNarrative;
    } catch {
      return null;
    }
  }
}
