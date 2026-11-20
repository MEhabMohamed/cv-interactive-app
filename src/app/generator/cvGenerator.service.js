import { apiRequest } from '../../lib/api/client';

export async function generateCvViaApi(candidate) {
  const data = await apiRequest('/api/cv/generate', {
    method: 'POST',
    body: candidate,
  });
  return data.cvText;
}

