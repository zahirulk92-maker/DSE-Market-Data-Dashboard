type SupabaseRequestInit = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
};

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !apiKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) must be configured.",
    );
  }

  return { url, apiKey };
}

export async function supabaseRequest<T>(
  tablePath: string,
  init: SupabaseRequestInit = {},
): Promise<T> {
  const { url, apiKey } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${tablePath}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      ...init.headers,
    },
  });

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
