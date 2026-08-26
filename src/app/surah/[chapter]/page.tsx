import type { Metadata } from "next";
import Link from "next/link";

type Verse = {
  chapter: number;
  verse: number;
  text: string;
};

type ChapterResponse = {
  chapter: Verse[];
};

type ChapterInfo = {
  chapter: number;
  name: string;
  englishname: string;
  arabicname: string;
  revelation: string;
};

type QuranInfo = {
  chapters: ChapterInfo[];
};

const API_BASE = "https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1";
const ARABIC_EDITION = "ara-quranuthmanihaf";
const ENGLISH_EDITION = "eng-abdullahyusufal";

async function fetchJson<T>(path: string): Promise<T | null> {
  for (const suffix of [".min.json", ".json"]) {
    try {
      const response = await fetch(`${API_BASE}/${path}${suffix}`, {
        cache: "force-cache",
      });

      if (response.ok) {
        return (await response.json()) as T;
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function getChapter(chapter: number) {
  const [info, arabic, english] = await Promise.all([
    fetchJson<QuranInfo>("info"),
    fetchJson<ChapterResponse>(`editions/${ARABIC_EDITION}/${chapter}`),
    fetchJson<ChapterResponse>(`editions/${ENGLISH_EDITION}/${chapter}`),
  ]);

  return {
    meta: info?.chapters.find((item) => item.chapter === chapter),
    arabic: arabic?.chapter ?? [],
    english: english?.chapter ?? [],
  };
}

export function generateStaticParams() {
  return Array.from({ length: 114 }, (_, index) => ({
    chapter: String(index + 1),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ chapter: string }>;
}): Promise<Metadata> {
  const { chapter: chapterParam } = await params;
  const chapter = Number(chapterParam);
  const { meta } = await getChapter(chapter);
  const name = meta?.englishname ?? `Surah ${chapter}`;
  const arabicName = meta?.arabicname ?? "";

  return {
    title: `${name} (Surah ${chapter})`,
    description: `Read Surah ${chapter}, ${name}${arabicName ? ` (${arabicName})` : ""}, with Arabic text and Abdullah Yusuf Ali English translation on Noor Quran Companion.`,
    alternates: {
      canonical: `/surah/${chapter}/`,
    },
    openGraph: {
      title: `${name} (Surah ${chapter})`,
      description: `Read ${name} online with Arabic text and English translation.`,
      url: `/surah/${chapter}/`,
      type: "article",
    },
  };
}

export default async function SurahPage({
  params,
}: {
  params: Promise<{ chapter: string }>;
}) {
  const { chapter: chapterParam } = await params;
  const chapter = Number(chapterParam);
  const { meta, arabic, english } = await getChapter(chapter);
  const name = meta?.englishname ?? `Surah ${chapter}`;
  const arabicName = meta?.arabicname ?? "";

  return (
    <main className="min-h-screen bg-[#faf6ee] px-4 py-8 text-stone-950 sm:px-8 lg:px-12">
      <article className="mx-auto max-w-4xl">
        <header className="border-b border-stone-900/10 pb-8">
          <Link href="/" className="text-sm font-semibold text-amber-800 hover:text-amber-950">
            Noor Quran Companion
          </Link>
          <p className="mt-10 text-sm font-semibold uppercase tracking-[0.28em] text-amber-800">
            Surah {chapter} {meta?.revelation ? `· ${meta.revelation}` : ""}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            {name}
          </h1>
          <p dir="rtl" lang="ar" className="mt-3 text-3xl text-stone-600">
            {arabicName}
          </p>
          <p className="mt-5 max-w-2xl text-base leading-7 text-stone-600">
            Read {name} online with Arabic Quran text and Abdullah Yusuf Ali English translation.
          </p>
          <Link
            href={`/?chapter=${chapter}&translation=${ENGLISH_EDITION}`}
            className="mt-6 inline-flex rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-900"
          >
            Open interactive reader
          </Link>
        </header>

        <ol className="divide-y divide-stone-900/10">
          {arabic.map((verse, index) => (
            <li key={verse.verse} className="grid gap-6 py-8 sm:grid-cols-[4rem_1fr]">
              <span className="text-sm font-semibold text-amber-800">{verse.verse}</span>
              <div>
                <p dir="rtl" lang="ar" className="text-right text-3xl leading-[2] text-stone-950">
                  {verse.text}
                </p>
                <p className="mt-5 text-base leading-8 text-stone-700">
                  {english[index]?.text ?? ""}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <footer className="border-t border-stone-900/10 py-8 text-sm text-stone-600">
          Noor Quran Companion provides Quran reading, translation, audio, bookmarks, and progress tracking.
        </footer>
      </article>
    </main>
  );
}