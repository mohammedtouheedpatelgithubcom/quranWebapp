import QuranReader from "./quran-reader";

type VerseItem = {
  chapter: number;
  verse: number;
  text: string;
};

type ChapterResponse = {
  chapter: VerseItem[];
};

type ChapterMeta = {
  chapter: number;
  name: string;
  englishname: string;
  arabicname: string;
  revelation: string;
  verses: Array<{
    verse: number;
    line: number;
    juz: number;
    manzil: number;
    page: number;
    ruku: number;
    maqra: number;
    sajda: boolean;
  }>;
};

type QuranInfo = {
  verses: {
    count: number;
  };
  chapters: ChapterMeta[];
};

type SearchParams = {
  chapter?: string;
  translation?: string;
};

type QuranPageProps = {
  searchParams?: Promise<SearchParams>;
};

const API_VERSION = "1";
const BASE_URL = `https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@${API_VERSION}`;
const ARABIC_EDITION = "ara-quranuthmanihaf";
const DEFAULT_TRANSLATION = "eng-abdullahyusufal";
const API_TIMEOUT_MS = 4500;

async function fetchJson<T>(path: string): Promise<T | null> {
  for (const suffix of [".min.json", ".json"]) {
    try {
      const response = await fetch(`${BASE_URL}/${path}${suffix}`, {
        next: { revalidate: 60 * 60 * 24 },
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
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

function parseChapterNumber(value?: string) {
  const parsed = Number(value ?? "1");
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 114) {
    return 1;
  }

  return parsed;
}

function parseTranslation(value?: string) {
  const allowedTranslations = new Set([
    DEFAULT_TRANSLATION,
    "eng-mustafakhattabg",
    "eng-ummmuhammad",
    "eng-muhammadsarwar",
  ]);

  if (value && allowedTranslations.has(value)) {
    return value;
  }

  return DEFAULT_TRANSLATION;
}

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: QuranPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const chapterNumber = parseChapterNumber(resolvedSearchParams.chapter);
  const translationSlug = parseTranslation(resolvedSearchParams.translation);

  const [info, arabicResponse, translationResponse] = await Promise.all([
    fetchJson<QuranInfo>("info"),
    fetchJson<ChapterResponse>(`editions/${ARABIC_EDITION}/${chapterNumber}`),
    fetchJson<ChapterResponse>(`editions/${translationSlug}/${chapterNumber}`),
  ]);

  return (
    <QuranReader
      key={`${chapterNumber}-${translationSlug}`}
      info={info}
      arabicVerses={arabicResponse?.chapter ?? []}
      translationVerses={translationResponse?.chapter ?? []}
      initialChapter={chapterNumber}
      initialTranslation={translationSlug}
    />
  );
}
