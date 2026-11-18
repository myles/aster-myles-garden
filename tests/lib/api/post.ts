// Posts a JSON body to an API handler, as a caller would.

export const NATAL = {
  date: "1990-05-15",
  time: "14:30",
  latitude: 43.70643,
  longitude: -79.39864,
  timeZone: "America/Toronto",
};

export async function postJson<T>(
  handle: (request: Request) => Promise<Response>,
  path: string,
  body: unknown,
): Promise<{ status: number; data: T; response: Response }> {
  const response = await handle(
    new Request(`https://aster.myles.garden${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

  return {
    status: response.status,
    data: (await response.json()) as T,
    response,
  };
}
