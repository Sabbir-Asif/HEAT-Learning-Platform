const MAX_BYTES = 8192;
let received = 0;

export async function POST(request: Request) {
  const body = await request.text();
  if (body.length > MAX_BYTES) return new Response(null, { status: 413 });
  received += 1;
  return new Response(null, { status: 204 });
}

export function GET() {
  return Response.json({ received });
}
