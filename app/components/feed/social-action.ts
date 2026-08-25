export async function requestSocialAction<T>(
  url: string,
  options: {
    body?: object;
    onUnauthorized?: () => void;
  } = {},
): Promise<T | null> {
  const response = await fetch(url, {
    method: 'POST',
    headers: options.body
      ? { 'Content-Type': 'application/json' }
      : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (response.status === 401) {
    options.onUnauthorized?.();
    return null;
  }
  if (!response.ok) {
    throw new Error(`Social action failed with status ${response.status}.`);
  }
  return response.json() as Promise<T>;
}
