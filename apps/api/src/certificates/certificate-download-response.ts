export interface HeaderResponse {
  setHeader(name: string, value: string): unknown;
}

export const applyDownloadHeaders = (
  response: HeaderResponse,
  headers: Record<string, string>,
): void => {
  for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
};
