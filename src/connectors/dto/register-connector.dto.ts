export interface RegisterConnectorDto {
  pluginKey: string;
  projectId?: string;
  config: Record<string, unknown>;
}
