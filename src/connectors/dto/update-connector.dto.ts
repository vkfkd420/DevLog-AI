export interface UpdateConnectorDto {
  config?: Record<string, unknown>;
  status?: 'enabled' | 'disabled';
}
