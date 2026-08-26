"use client";

import { useEffect, useState } from "react";
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

const API_VERSION = "1";
const BASE_URL = `https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@${API_VERSION}`;
const ARABIC_EDITION = "ara-quranuthmanihaf";
const DEFAULT_TRANSLATION = "eng-abdullahyusufal";
const API_TIMEOUT_MS = 4500;

async function fetchJson<T>(path: string): Promise<T | null> {
  for (const suffix of [".min.json", ".json"]) {
    try {
      const response = await fetch(`${BASE_URL}/${path}${suffix}`, {
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

export default function Page() {
  const [chapterNumber, setChapterNumber] = useState(1);
  const [translationSlug, setTranslationSlug] = useState(DEFAULT_TRANSLATION);
  const [info, setInfo] = useState<QuranInfo | null>(null);
  const [arabicVerses, setArabicVerses] = useState<VerseItem[]>([]);
  const [translationVerses, setTranslationVerses] = useState<VerseItem[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    queueMicrotask(() => {
      setChapterNumber(parseChapterNumber(params.get("chapter") ?? undefined));
      setTranslationSlug(parseTranslation(params.get("translation") ?? undefined));
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetchJson<QuranInfo>("info"),
      fetchJson<ChapterResponse>(`editions/${ARABIC_EDITION}/${chapterNumber}`),
      fetchJson<ChapterResponse>(`editions/${translationSlug}/${chapterNumber}`),
    ]).then(([nextInfo, arabicResponse, translationResponse]) => {
      if (cancelled) return;
      setInfo(nextInfo);
      setArabicVerses(arabicResponse?.chapter ?? []);
      setTranslationVerses(translationResponse?.chapter ?? []);
    });

    return () => {
      cancelled = true;
    };
  }, [chapterNumber, translationSlug]);

  return (
    <QuranReader
      key={`${chapterNumber}-${translationSlug}`}
      info={info}
      arabicVerses={arabicVerses}
      translationVerses={translationVerses}
      initialChapter={chapterNumber}
      initialTranslation={translationSlug}
    />
  );
}
