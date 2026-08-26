import type { MetadataRoute } from "next";

const siteUrl = "https://mohammedtouheedpatelgithubcom.github.io/quranWebapp";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const surahPages = Array.from({ length: 114 }, (_, index) => ({
    url: `${siteUrl}/surah/${index + 1}/`,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  return [
    {
      url: `${siteUrl}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...surahPages,
  ];
}