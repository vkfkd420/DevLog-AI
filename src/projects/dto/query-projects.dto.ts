export interface QueryProjectsDto {
  /** 'true'면 archive된 프로젝트도 포함, 기본은 활성 프로젝트만 */
  includeArchived?: string;
}
