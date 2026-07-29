// 프로젝트마다 구분되는 색상을 부여하기 위한 공용 팔레트.
// 앱의 웜톤에 어울리면서도 서로 뚜렷이 구분되도록 골랐다. (달력, 통합 타임라인 등에서 공유)
export const PROJECT_COLORS = ['#d97757', '#6b9080', '#6c8ead', '#cf9d3f', '#9b6b9e', '#7d8597'];

export function colorForProject(projectId: string, sortedProjectIds: string[]): string {
  const index = sortedProjectIds.indexOf(projectId);
  return PROJECT_COLORS[index >= 0 ? index % PROJECT_COLORS.length : 0];
}
