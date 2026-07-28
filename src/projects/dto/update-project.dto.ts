export interface UpdateProjectDto {
  name?: string;
  /** true면 archive, false면 복구 */
  archived?: boolean;
}
