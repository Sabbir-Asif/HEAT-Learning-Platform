const MAX_BYTES = 8192;
let received = 0;

function tooLarge() {
  return new Response(null, { status: 413 });
}

async function readLimited(body: ReadableStream<Uint8Array> | null): Promise<string | null> {
  if (!body) return "";
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
}

export async function POST(request: Request) {
  const declared = request.headers.get("content-length");
  if (declared !== null && Number(declared) > MAX_BYTES) return tooLarge();
  const body = await readLimited(request.body);
  if (body === null) return tooLarge();
  try {
    JSON.parse(body || "{}");
  } catch {
    return new Response(null, { status: 400 });
  }
  received += 1;
  return new Response(null, { status: 204 });
}

export function GET() {
  return Response.json({ received });
}
