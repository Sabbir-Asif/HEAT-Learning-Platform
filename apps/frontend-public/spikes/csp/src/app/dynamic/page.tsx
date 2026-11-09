import { headers } from "next/headers";
import { Suspense } from "react";

async function Nonce() {
  const requestHeaders = await headers();
  return <p data-nonce={requestHeaders.get("x-nonce")}>dynamic</p>;
}

export default function DynamicPage() {
  return (
    <main>
      <Suspense fallback={<p>loading</p>}>
        <Nonce />
      </Suspense>
    </main>
  );
}
