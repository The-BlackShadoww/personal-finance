import { buildUrl, ensureAccessToken, getAccessToken } from './client';

export interface ReportDownloadParams {
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
}

async function downloadReportBlob(
  endpoint: string,
  params: ReportDownloadParams,
): Promise<Blob> {
  // The access token is in-memory and short-lived; renew it if needed.
  await ensureAccessToken();
  const token = getAccessToken();

  const searchParams = new URLSearchParams({
    startYear: String(params.startYear),
    startMonth: String(params.startMonth),
    endYear: String(params.endYear),
    endMonth: String(params.endMonth),
  });
  const url = `${buildUrl(endpoint)}?${searchParams.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
  });

  if (response.status === 401) {
    throw new Error('Your session has expired. Please refresh the page and try again.');
  }

  if (response.status === 429) {
    throw new Error('Download limit reached. Please wait before downloading again.');
  }

  if (!response.ok) {
    let message = `Download failed (${response.status})`;
    try {
      const errorBody = await response.json();
      message = errorBody.message ?? message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.blob();
}

export const reportsApi = {
  downloadCsv: (params: ReportDownloadParams) =>
    downloadReportBlob('/reports/csv', params),

  downloadPdf: (params: ReportDownloadParams) =>
    downloadReportBlob('/reports/pdf', params),
};
