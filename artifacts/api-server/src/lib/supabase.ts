import { ReplitConnectors } from "@replit/connectors-sdk";

const connectors = new ReplitConnectors();

type SupabaseRequestInit = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
};

export async function supabaseRequest<T>(
  tablePath: string,
  init: SupabaseRequestInit = {},
): Promise<T> {
  const response = await connectors.proxy(
    "supabase",
    `/rest/v1/${tablePath}`,
    {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...init.headers,
      },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Supabase request failed (${response.status}): ${body.slice(0, 240)}`,
    );
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}