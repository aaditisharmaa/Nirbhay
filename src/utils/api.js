import { getAuthHeaders } from './firebase';

export async function authenticatedHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(await getAuthHeaders())
  };
}
