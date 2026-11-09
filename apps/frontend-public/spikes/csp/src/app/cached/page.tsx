import Image from "next/image";

async function loadCachedText() {
  "use cache";
  return "cached at build";
}

export default async function CachedPage() {
  const text = await loadCachedText();
  return (
    <main>
      <p>{text}</p>
      <Image src="/brand/heat.svg" alt="HEAT" width={64} height={64} unoptimized />
    </main>
  );
}
