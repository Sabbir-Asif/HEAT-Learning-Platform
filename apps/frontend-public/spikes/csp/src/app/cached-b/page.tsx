async function loadCachedText() {
  "use cache";
  return "a different cached page";
}

export default async function CachedBPage() {
  const text = await loadCachedText();
  return (
    <main>
      <p>{text}</p>
    </main>
  );
}
