const backendUrl = process.env.BACKEND_API_URL ?? "http://127.0.0.1:4000";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const response = await fetch(`${backendUrl}/api/v1/analyses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      cache: "no-store",
    });
    const responseBody = await response.text();

    return new Response(responseBody, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return Response.json(
      {
        error: "BackendUnavailable",
        message: "The analysis service is unavailable",
      },
      { status: 503 },
    );
  }
}
