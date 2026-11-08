import { getTranslations } from "next-intl/server";

export default async function HomePage() {
  const t = await getTranslations("site.home");
  return (
    <main>
      <h1>{t("heading")}</h1>
    </main>
  );
}
