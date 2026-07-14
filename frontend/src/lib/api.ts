const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

interface FetchOptions extends RequestInit {
  token?: string;
}

export class APIError extends Error {
  status: number;
  data: any;

  constructor(status: number, data: any) {
    super(data.error || data.message || `API request failed with status ${status}`);
    this.status = status;
    this.data = data;
  }
}

// request wraps browser fetch with header configurations, token attachment,
// and detailed error throwing.
export async function request(path: string, options: FetchOptions = {}): Promise<any> {
  const url = `${API_URL}${path}`;
  const headers = new Headers(options.headers);

  // Default to JSON content type
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Attach authorization header if token is supplied
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  } else if (typeof window !== "undefined") {
    // Fallback: Read token from localStorage on the client side
    const token = localStorage.getItem("haven_access_token");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle empty 204 response
  if (response.status === 204) {
    return null;
  }

  let data;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = { message: await response.text() };
  }

  if (!response.ok) {
    throw new APIError(response.status, data);
  }

  return data;
}

// refreshTokens calls the refresh token endpoint to rotate credentials.
export async function refreshTokens(refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  return request("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}
