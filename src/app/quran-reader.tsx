"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";

type VerseItem = {
  chapter: number;
  verse: number;
  text: string;
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

type QuranReaderProps = {
  info: QuranInfo | null;
  arabicVerses: VerseItem[];
  translationVerses: VerseItem[];
  initialChapter: number;
  initialTranslation: string;
};

type AuthMode = "signin" | "signup";

type UserProfile = {
  id: string;
  display_name: string;
  favorite_chapter: number;
  daily_goal: number;
  streak_count: number;
  learning_theme: string;
  last_seen_at: string | null;
};

type CommunityPost = {
  id: string;
  display_name: string;
  chapter: number;
  verse: number | null;
  body: string;
  created_at: string;
  likes_count: number;
};

const DEMO_PROFILE: UserProfile = {
  id: "demo-user",
  display_name: "Noor Reader",
  favorite_chapter: 67,
  daily_goal: 7,
  streak_count: 12,
  learning_theme: "Mercy and consistency",
  last_seen_at: null,
};

const DEMO_COMMUNITY_POSTS: CommunityPost[] = [
  {
    id: "demo-post-1",
    display_name: "Amina",
    chapter: 55,
    verse: 13,
    body: "I paired today's recitation with one gratitude note. The rhythm made it stick.",
    created_at: "2026-06-05T18:15:00.000Z",
    likes_count: 18,
  },
  {
    id: "demo-post-2",
    display_name: "Zayd",
    chapter: 18,
    verse: 10,
    body: "A 5 minute reading sprint and one bookmark is enough to keep the habit alive.",
    created_at: "2026-06-05T16:40:00.000Z",
    likes_count: 11,
  },
  {
    id: "demo-post-3",
    display_name: "Fatimah",
    chapter: 94,
    verse: 5,
    body: "I keep returning to this verse when my day feels compressed.",
    created_at: "2026-06-05T15:00:00.000Z",
    likes_count: 24,
  },
];

const BOOKMARKS_STORAGE_KEY = "noor-bookmarks";
const PROGRESS_STORAGE_KEY = "noor-progress";
const LOCAL_AUTH_SESSION_KEY = "noor-local-auth-session";
const RECITER = "AbdulSamad_64kbps_QuranExplorer.Com";
const AUDIO_BASE = `https://everyayah.com/data/${RECITER}`;
const BACKEND_HINT = hasSupabaseConfig ? "connected" : "demo-mode";

const chapterMenu = [
  { chapter: 1, name: "Al-Fatiha", arabic: "الفاتحة", focus: "Opening" },
  { chapter: 18, name: "Al-Kahf", arabic: "الكهف", focus: "Light & patience" },
  { chapter: 36, name: "Yaseen", arabic: "يس", focus: "The heart of the Qur'an" },
  { chapter: 55, name: "Ar-Rahman", arabic: "الرحمن", focus: "Mercy and gratitude" },
  { chapter: 67, name: "Al-Mulk", arabic: "الملك", focus: "Night reflection" },
  { chapter: 112, name: "Al-Ikhlas", arabic: "الإخلاص", focus: "Tawheed" },
  { chapter: 113, name: "Al-Falaq", arabic: "الفلق", focus: "Seeking protection" },
  { chapter: 114, name: "An-Nas", arabic: "الناس", focus: "Seeking refuge" },
];

const translationMenu = [
  { slug: "eng-abdullahyusufal", label: "Yusuf Ali", description: "Classic, detailed English" },
  { slug: "eng-mustafakhattabg", label: "Mustafa Khattab", description: "Modern and readable" },
  { slug: "eng-ummmuhammad", label: "Umm Muhammad", description: "Balanced phrasing" },
  { slug: "eng-muhammadsarwar", label: "Muhammad Sarwar", description: "Clear, direct translation" },
];

function buildQuery(chapter: number, translation: string) {
  return `?chapter=${chapter}&translation=${translation}`;
}

function formatPageRange(meta?: ChapterMeta) {
  if (!meta || meta.verses.length === 0) {
    return "Unknown";
  }

  const first = meta.verses[0].page;
  const last = meta.verses[meta.verses.length - 1].page;
  return first === last ? `Page ${first}` : `Pages ${first}-${last}`;
}

function pad(value: number) {
  return String(value).padStart(3, "0");
}

function verseAudioUrl(chapter: number, verse: number) {
  return `${AUDIO_BASE}/${pad(chapter)}${pad(verse)}.mp3`;
}

function loadLocalStorageSet(storageKey: string) {
  if (typeof window === "undefined") return new Set<string>();

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((value) => typeof value === "string"));
    }
  } catch {
    // Ignore storage parse errors and start fresh.
  }

  return new Set<string>();
}

function loadLocalJson<T>(storageKey: string, fallback: T) {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveLocalJson(storageKey: string, value: unknown) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(storageKey, JSON.stringify(value));
}

function createLocalSession(email: string) {
  const id = `local-${email.toLowerCase()}`;
  return {
    access_token: id,
    token_type: "bearer",
    user: {
      id,
      email,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    },
  } as Session;
}

function loadLocalProfile(userId: string, chapterNumber: number) {
  if (typeof window === "undefined") {
    return createFallbackProfile(chapterNumber);
  }

  return loadLocalJson<UserProfile | null>(`noor-local-profile-${userId}`, null) ?? createFallbackProfile(chapterNumber);
}

function formatRelativeTime(timestamp: string) {
  const diffMinutes = Math.max(1, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return `${Math.floor(diffHours / 24)}d ago`;
}

function getChapterLabel(chapter?: number) {
  return chapterMenu.find((item) => item.chapter === chapter)?.name ?? `Chapter ${chapter ?? 1}`;
}

function createFallbackProfile(chapterNumber: number): UserProfile {
  return {
    ...DEMO_PROFILE,
    favorite_chapter: chapterNumber,
    last_seen_at: new Date().toISOString(),
  };
}

function getRecommendedChapter(profile: UserProfile | null, currentChapter: number) {
  if (!profile) {
    return chapterMenu[0];
  }

  return chapterMenu.find((item) => item.chapter === profile.favorite_chapter) ?? chapterMenu.find((item) => item.chapter === currentChapter + 1) ?? chapterMenu[0];
}

export default function QuranReader({
  info,
  arabicVerses,
  translationVerses,
  initialChapter,
  initialTranslation,
}: QuranReaderProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const chapterCount = info?.chapters.length ?? 114;
  const verseCount = info?.verses.count ?? 6236;
  const [chapterNumber, setChapterNumber] = useState(initialChapter);
  const [translationSlug, setTranslationSlug] = useState(initialTranslation);
  const [chapterSearch, setChapterSearch] = useState("");
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<Set<string>>(new Set());
  const [activeVerse, setActiveVerse] = useState<{ chapter: number; verse: number } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>(DEMO_COMMUNITY_POSTS);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authStatus, setAuthStatus] = useState(
    hasSupabaseConfig ? "Connect your account to enable sync and community learning." : "Demo mode is active. Add Supabase env vars to enable signup and backend sync.",
  );
  const [displayName, setDisplayName] = useState("");
  const [learningTheme, setLearningTheme] = useState("");
  const [goalInput, setGoalInput] = useState("7");
  const [communityDraft, setCommunityDraft] = useState("");
  const [communityChapter, setCommunityChapter] = useState(String(initialChapter));
  const [communityVerse, setCommunityVerse] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const continuePlaybackRef = useRef(false);
  const autoStartHandledRef = useRef(false);

  useEffect(() => {
    queueMicrotask(() => {
      setBookmarks(loadLocalStorageSet(BOOKMARKS_STORAGE_KEY));
      setProgress(loadLocalStorageSet(PROGRESS_STORAGE_KEY));
    });
  }, []);

  useEffect(() => {
    if (!supabase) {
      queueMicrotask(() => {
        const savedSession = loadLocalJson<Session | null>(LOCAL_AUTH_SESSION_KEY, null);
        if (savedSession) {
          const localProfile = loadLocalProfile(savedSession.user.id, initialChapter);
          setSession(savedSession);
          setProfile(localProfile);
          setDisplayName(localProfile.display_name);
          setLearningTheme(localProfile.learning_theme);
          setGoalInput(String(localProfile.daily_goal));
        } else {
          setProfile(createFallbackProfile(initialChapter));
          setDisplayName(DEMO_PROFILE.display_name);
          setLearningTheme(DEMO_PROFILE.learning_theme);
          setGoalInput(String(DEMO_PROFILE.daily_goal));
        }
      });
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [initialChapter, supabase]);

  useEffect(() => {
    if (!supabase || !session?.user) {
      return;
    }

    async function loadBackendData() {
      const currentSupabase = supabase;
      const currentSession = session;
      if (!currentSupabase || !currentSession?.user) {
        return;
      }

      const userId = currentSession.user.id;

      const [{ data: profileRow }, { data: bookmarkRows }, { data: progressRows }, { data: posts }] = await Promise.all([
        currentSupabase.from("profiles").select("id, display_name, favorite_chapter, daily_goal, streak_count, learning_theme, last_seen_at").eq("id", userId).maybeSingle(),
        currentSupabase.from("bookmarks").select("chapter, verse").eq("user_id", userId).order("created_at", { ascending: false }),
        currentSupabase.from("progress_entries").select("chapter, verse").eq("user_id", userId).order("created_at", { ascending: false }),
        currentSupabase.from("community_posts").select("id, display_name, chapter, verse, body, created_at, likes_count").order("created_at", { ascending: false }).limit(12),
      ]);

      if (profileRow) {
        const nextProfile = profileRow as UserProfile;
        setProfile(nextProfile);
        setDisplayName(nextProfile.display_name);
        setLearningTheme(nextProfile.learning_theme);
        setGoalInput(String(nextProfile.daily_goal));
      } else {
        const nextProfile = createFallbackProfile(chapterNumber);
        setProfile(nextProfile);
        setDisplayName(nextProfile.display_name);
        setLearningTheme(nextProfile.learning_theme);
        setGoalInput(String(nextProfile.daily_goal));
      }

      setBookmarks(new Set((bookmarkRows ?? []).map((row) => `${row.chapter}:${row.verse}`)));
      setProgress(new Set((progressRows ?? []).map((row) => `${row.chapter}:${row.verse}`)));
      setCommunityPosts((posts as CommunityPost[]) ?? DEMO_COMMUNITY_POSTS);
    }

    loadBackendData().catch(() => {
      setAuthStatus("Could not load backend data. Check your Supabase tables and policies.");
    });
  }, [chapterNumber, session, supabase]);

  useEffect(() => {
    if (profile) {
      queueMicrotask(() => {
        setDisplayName(profile.display_name);
        setLearningTheme(profile.learning_theme);
        setGoalInput(String(profile.daily_goal));
      });
    }
  }, [profile]);

  useEffect(() => {
    if (!activeVerse || !audioRef.current) return;

    audioRef.current.src = verseAudioUrl(activeVerse.chapter, activeVerse.verse);
    audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }, [activeVerse]);

  useEffect(() => {
    if (autoStartHandledRef.current || translationVerses.length === 0 || typeof window === "undefined") return;

    const shouldAutoStart = new URLSearchParams(window.location.search).get("autoplay") === "1";
    if (!shouldAutoStart) {
      autoStartHandledRef.current = true;
      return;
    }

    autoStartHandledRef.current = true;
    continuePlaybackRef.current = true;
    setActiveVerse({ chapter: initialChapter, verse: translationVerses[0].verse });
    window.history.replaceState({}, "", `${buildQuery(initialChapter, initialTranslation)}#reader`);
  }, [initialChapter, initialTranslation, translationVerses]);

  const currentChapter = info?.chapters.find((item) => item.chapter === chapterNumber);
  const translationLabel = translationMenu.find((item) => item.slug === translationSlug)?.label ?? translationMenu[0].label;
  const selectedChapterCard = currentChapter
    ? {
        chapter: currentChapter.chapter,
        name: currentChapter.name,
        arabic: currentChapter.arabicname,
        focus: currentChapter.revelation,
      }
    : chapterMenu.find((item) => item.chapter === chapterNumber) ?? {
        chapter: chapterNumber,
        name: `Chapter ${chapterNumber}`,
        arabic: "",
        focus: "Selected chapter",
      };
  const selectedVerseCount = currentChapter?.verses.length ?? translationVerses.length;
  const previewVerses = translationVerses.map((verse, index) => ({
    verseNumber: verse.verse,
    arabic: arabicVerses[index]?.text ?? verse.text,
    translation: verse.text,
  }));

  const heroVerse = previewVerses[0] ?? {
    verseNumber: 1,
    arabic: "Data not available yet.",
    translation: "Try another chapter or refresh the page.",
  };

  const filteredChapters = useMemo(() => {
    const query = chapterSearch.trim().toLowerCase();
    const baseList = info?.chapters ?? [];

    if (!query) {
      return baseList.slice(0, 18);
    }

    return baseList.filter((item) => {
      return [item.name, item.englishname, item.arabicname, String(item.chapter)]
        .join(" ")
        .toLowerCase()
        .includes(query);
    }).slice(0, 18);
  }, [chapterSearch, info]);

  function updateQuery(nextChapter: number, nextTranslation: string, autoplay = false) {
    const nextUrl = buildQuery(nextChapter, nextTranslation);
    const playbackQuery = autoplay ? "&autoplay=1" : "";
    window.location.assign(`${nextUrl}${playbackQuery}#reader`);
  }

  function toggleBookmark(verseNumber: number) {
    const key = `${chapterNumber}:${verseNumber}`;

    setBookmarks((current) => {
      const next = new Set(current);
      const isBookmarked = !next.has(key);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      window.localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(Array.from(next)));
      void syncBookmark(key, isBookmarked);
      return next;
    });
  }

  function markProgress(verseNumber: number) {
    const key = `${chapterNumber}:${verseNumber}`;

    setProgress((current) => {
      const next = new Set(current);
      next.add(key);
      window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(Array.from(next)));
      void syncProgress(key);
      return next;
    });
  }

  function playVerse(verseNumber: number) {
    continuePlaybackRef.current = true;
    setActiveVerse({ chapter: chapterNumber, verse: verseNumber });
  }

  function toggleAudio() {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      continuePlaybackRef.current = true;
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      continuePlaybackRef.current = false;
      audio.pause();
      setIsPlaying(false);
    }
  }

  function stopAudio() {
    const audio = audioRef.current;
    continuePlaybackRef.current = false;
    audio?.pause();
    if (audio) {
      audio.currentTime = 0;
    }
    setActiveVerse(null);
    setIsPlaying(false);
  }

  function handleAudioEnded() {
    if (!activeVerse) return;

    markProgress(activeVerse.verse);
    if (!continuePlaybackRef.current) {
      setIsPlaying(false);
      return;
    }

    const currentIndex = translationVerses.findIndex((verse) => verse.verse === activeVerse.verse);
    const nextVerse = translationVerses[currentIndex + 1];

    if (!nextVerse) {
      continuePlaybackRef.current = false;
      setIsPlaying(false);
      setActiveVerse(null);
      return;
    }

    setActiveVerse({ chapter: chapterNumber, verse: nextVerse.verse });
  }

  async function handleAuthSubmit() {
    if (!supabase) {
      const email = authEmail.trim().toLowerCase();
      const password = authPassword.trim();

      if (!email || !password) {
        setAuthStatus("Enter both email and password.");
        return;
      }

      const nextSession = createLocalSession(email);
      setSession(nextSession);
      saveLocalJson(LOCAL_AUTH_SESSION_KEY, nextSession);

      const nextProfile = loadLocalProfile(nextSession.user.id, initialChapter);
      setProfile(nextProfile);
      setDisplayName(nextProfile.display_name);
      setLearningTheme(nextProfile.learning_theme);
      setGoalInput(String(nextProfile.daily_goal));

      setAuthStatus(authMode === "signup" ? "Demo account created for this browser. Add Supabase to enable real secure auth." : "Signed in locally in demo mode.");
      setAuthPassword("");
      return;
    }

    const email = authEmail.trim();
    if (!email || !authPassword.trim()) {
      setAuthStatus("Enter both email and password.");
      return;
    }

    const action = authMode === "signin"
      ? supabase.auth.signInWithPassword({ email, password: authPassword })
      : supabase.auth.signUp({ email, password: authPassword });

    const { data, error } = await action;

    if (error) {
      setAuthStatus(error.message);
      return;
    }

    if (authMode === "signup" && !data.session) {
      setAuthStatus("Signup created. Check email verification to finish activating the account.");
    } else {
      setAuthStatus("Signed in successfully.");
    }

    setAuthPassword("");
  }

  async function handleSignOut() {
    if (supabase) {
      await supabase.auth.signOut();
    }

    if (!supabase) {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(LOCAL_AUTH_SESSION_KEY);
      }
    }

    setSession(null);
    setProfile(createFallbackProfile(chapterNumber));
    setCommunityPosts(DEMO_COMMUNITY_POSTS);
    setAuthStatus("Signed out.");
  }

  async function saveProfile() {
    const nextProfile: UserProfile = {
      id: session?.user?.id ?? profile?.id ?? DEMO_PROFILE.id,
      display_name: displayName.trim() || profile?.display_name || DEMO_PROFILE.display_name,
      favorite_chapter: chapterNumber,
      daily_goal: Number(goalInput) > 0 ? Number(goalInput) : 7,
      streak_count: profile?.streak_count ?? DEMO_PROFILE.streak_count,
      learning_theme: learningTheme.trim() || profile?.learning_theme || DEMO_PROFILE.learning_theme,
      last_seen_at: new Date().toISOString(),
    };

    setProfile(nextProfile);

    if (!supabase || !session?.user) {
      if (session?.user) {
        saveLocalJson(`noor-local-profile-${session.user.id}`, nextProfile);
      }
      setAuthStatus("Profile saved locally in demo mode.");
      return;
    }

    const { error } = await supabase.from("profiles").upsert(nextProfile, { onConflict: "id" });
    if (error) {
      setAuthStatus(error.message);
      return;
    }

    setAuthStatus("Profile saved to your account.");
  }

  async function syncBookmark(key: string, bookmarked: boolean) {
    if (!supabase || !session?.user) {
      return;
    }

    const [chapter, verse] = key.split(":").map(Number);
    if (bookmarked) {
      await supabase.from("bookmarks").upsert({ user_id: session.user.id, chapter, verse }, { onConflict: "user_id,chapter,verse" });
    } else {
      await supabase.from("bookmarks").delete().eq("user_id", session.user.id).eq("chapter", chapter).eq("verse", verse);
    }
  }

  async function syncProgress(key: string) {
    if (!supabase || !session?.user) {
      return;
    }

    const [chapter, verse] = key.split(":").map(Number);
    await supabase.from("progress_entries").upsert({ user_id: session.user.id, chapter, verse }, { onConflict: "user_id,chapter,verse" });
  }

  async function publishCommunityPost() {
    const body = communityDraft.trim();
    const selectedChapter = Number(communityChapter) || chapterNumber;
    const selectedVerse = communityVerse.trim() ? Number(communityVerse) : null;

    if (!body) {
      setAuthStatus("Write something first.");
      return;
    }

    if (selectedChapter < 1 || selectedChapter > 114 || (selectedVerse !== null && selectedVerse < 1)) {
      setAuthStatus("Choose a valid chapter between 1 and 114 and an optional positive verse number.");
      return;
    }

    const nextPost: CommunityPost = {
      id: `local-${Date.now()}`,
      display_name: profile?.display_name ?? "Guest Reader",
      chapter: selectedChapter,
      verse: selectedVerse,
      body,
      created_at: new Date().toISOString(),
      likes_count: 0,
    };

    if (supabase && session?.user) {
      const { error } = await supabase.from("community_posts").insert({
        user_id: session.user.id,
        display_name: nextPost.display_name,
        chapter: nextPost.chapter,
        verse: nextPost.verse,
        body: nextPost.body,
        likes_count: 0,
      });

      if (error) {
        setAuthStatus(error.message);
        return;
      }

      const { data } = await supabase.from("community_posts").select("id, display_name, chapter, verse, body, created_at, likes_count").order("created_at", { ascending: false }).limit(12);
      setCommunityPosts((data as CommunityPost[]) ?? [nextPost, ...communityPosts]);
    } else {
      setCommunityPosts((current) => [nextPost, ...current].slice(0, 12));
      setAuthStatus("Published locally in demo mode.");
    }

    setCommunityDraft("");
    setCommunityVerse("");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(234,179,8,0.20),_transparent_34%),linear-gradient(180deg,_#fffaf0_0%,_#f7f2e8_48%,_#f1eadc_100%)] text-stone-950">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-6 py-6 sm:px-8 lg:px-10 lg:py-8">
        <header className="flex flex-col gap-5 rounded-[2rem] border border-stone-900/10 bg-white/72 px-6 py-5 shadow-[0_16px_48px_-30px_rgba(28,25,23,0.45)] backdrop-blur-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-800">
              Noor
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950 sm:text-3xl">
              Noor Quran Companion
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
              A focused Quran reader with Arabic text, translation, recitation, bookmarks, progress, and account sync.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a href="#today" className="rounded-full border border-stone-900/10 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:-translate-y-0.5 hover:border-amber-500/30 hover:text-stone-950">Today</a>
            <a href="#chapters" className="rounded-full border border-stone-900/10 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:-translate-y-0.5 hover:border-amber-500/30 hover:text-stone-950">Chapters</a>
            <a href="#reader" className="rounded-full border border-stone-900/10 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:-translate-y-0.5 hover:border-amber-500/30 hover:text-stone-950">Reader</a>
            <a href="#audio" className="rounded-full border border-stone-900/10 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:-translate-y-0.5 hover:border-amber-500/30 hover:text-stone-950">Audio</a>
          </div>
        </header>

        <section id="today" className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(145deg,_rgba(255,255,255,0.88),_rgba(255,248,232,0.95))] p-6 shadow-[0_22px_70px_-34px_rgba(120,53,15,0.42)] sm:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.18),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(120,53,15,0.08),_transparent_28%)]" />

            <div className="relative space-y-6">
              <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-amber-900">
                <span className="rounded-full border border-amber-900/10 bg-amber-50 px-3 py-2">Chapter {chapterNumber}</span>
                <span className="rounded-full border border-stone-900/10 bg-white px-3 py-2">{selectedChapterCard.name}</span>
                <span className="rounded-full border border-stone-900/10 bg-white px-3 py-2">{currentChapter?.revelation ?? "Revelation unknown"}</span>
              </div>

              <div className="max-w-3xl space-y-4">
                <p className="text-sm font-medium uppercase tracking-[0.35em] text-stone-500">Read. Reflect. Return.</p>
                <h2 className="text-4xl font-semibold tracking-tight text-stone-950 sm:text-5xl lg:text-6xl">Build a calmer Quran habit with live verses and focused menus.</h2>
                <p className="max-w-2xl text-base leading-8 text-stone-700 sm:text-lg">
                  Search the chapter list, pick a translation, bookmark verses, and play recitation for individual ayahs from the verse-by-verse audio source.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-[1.4rem] border border-stone-900/8 bg-white/80 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">Chapters</p>
                  <p className="mt-3 text-2xl font-semibold text-stone-950">{chapterCount}</p>
                  <p className="mt-2 text-sm leading-6 text-stone-600">Available in the API info catalog.</p>
                </div>
                <div className="rounded-[1.4rem] border border-stone-900/8 bg-white/80 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">Verses</p>
                  <p className="mt-3 text-2xl font-semibold text-stone-950">{verseCount.toLocaleString()}</p>
                  <p className="mt-2 text-sm leading-6 text-stone-600">Live from the info endpoint.</p>
                </div>
                <div className="rounded-[1.4rem] border border-stone-900/8 bg-white/80 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">Translation</p>
                  <p className="mt-3 text-2xl font-semibold text-stone-950">{translationLabel}</p>
                  <p className="mt-2 text-sm leading-6 text-stone-600">Current reading voice.</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-[1.8rem] border border-stone-900/8 bg-white/76 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-stone-500">Featured verse</p>
                <div className="mt-5 grid gap-5 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
                  <div className="rounded-[1.5rem] bg-stone-950 p-5 text-white shadow-[0_18px_34px_-24px_rgba(28,25,23,0.85)]">
                    <p dir="rtl" lang="ar" className="text-right text-4xl leading-tight font-semibold text-amber-100 sm:text-5xl">{heroVerse.arabic}</p>
                    <p className="mt-4 text-sm font-medium uppercase tracking-[0.32em] text-stone-400">Verse {heroVerse.verseNumber}</p>
                  </div>
                  <div className="space-y-4">
                    <p className="text-lg leading-8 text-stone-700 sm:text-xl">{heroVerse.translation}</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[1.2rem] border border-stone-900/8 bg-stone-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">Chapter name</p>
                        <p className="mt-2 text-base font-semibold text-stone-950">{currentChapter?.englishname ?? selectedChapterCard.name}</p>
                      </div>
                      <div className="rounded-[1.2rem] border border-stone-900/8 bg-stone-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">Location</p>
                        <p className="mt-2 text-base font-semibold text-stone-950">{formatPageRange(currentChapter)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <aside className="grid gap-6">
            <section className="rounded-[2rem] border border-stone-900/10 bg-white/82 p-6 shadow-[0_18px_50px_-34px_rgba(28,25,23,0.55)] backdrop-blur-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-stone-500">Session snapshot</p>
                  <h3 className="mt-2 text-xl font-semibold text-stone-950">Reading stats</h3>
                </div>
                <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-amber-900">Live</div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-[1.3rem] border border-stone-900/8 bg-stone-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">Selected chapter verses</p>
                  <p className="mt-2 text-2xl font-semibold text-stone-950">{selectedVerseCount}</p>
                </div>
                <div className="rounded-[1.3rem] border border-stone-900/8 bg-stone-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">Bookmarks</p>
                  <p className="mt-2 text-2xl font-semibold text-stone-950">{bookmarks.size}</p>
                </div>
                <div className="rounded-[1.3rem] border border-stone-900/8 bg-stone-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">Progress marks</p>
                  <p className="mt-2 text-2xl font-semibold text-stone-950">{progress.size}</p>
                </div>
              </div>
            </section>

            <section id="audio" className="rounded-[2rem] border border-stone-900/10 bg-stone-950 p-6 text-white shadow-[0_18px_50px_-34px_rgba(28,25,23,0.82)]">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-300/90">Audio</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight">Verse playback</h3>
              <p className="mt-3 text-sm leading-7 text-stone-300">
                Tap a verse to load recitation from the verse-by-verse MP3 source. Use the play button to toggle playback.
              </p>
              <div className="mt-5 flex flex-wrap gap-3 text-sm font-medium">
                <button
                  type="button"
                  onClick={() => playVerse(heroVerse.verseNumber)}
                  className="rounded-full bg-amber-400 px-4 py-2 text-stone-950 transition hover:bg-amber-300"
                >
                  Play featured ayah
                </button>
                <button
                  type="button"
                  onClick={toggleAudio}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-white transition hover:bg-white/10"
                >
                  {isPlaying ? "Pause audio" : "Play audio"}
                </button>
                <button
                  type="button"
                  onClick={stopAudio}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-white transition hover:bg-white/10"
                >
                  Stop audio
                </button>
              </div>
              <audio
                ref={audioRef}
                controls
                className="mt-5 w-full"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={handleAudioEnded}
              />
              {activeVerse ? (
                <p className="mt-4 text-sm text-stone-300">
                  Playing chapter {activeVerse.chapter}, verse {activeVerse.verse}.
                </p>
              ) : null}
            </section>
          </aside>
        </section>

        <section id="chapters" className="rounded-[2rem] border border-stone-900/10 bg-white/84 p-6 shadow-[0_18px_50px_-34px_rgba(28,25,23,0.45)] backdrop-blur-sm sm:p-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-stone-500">Chapter menu</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">Search and jump to surahs.</h3>
            </div>
            <label className="w-full max-w-md">
              <span className="sr-only">Search chapters</span>
              <input
                value={chapterSearch}
                onChange={(event) => setChapterSearch(event.target.value)}
                placeholder="Search by chapter name, Arabic name, or number"
                className="w-full rounded-full border border-stone-900/10 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-amber-500/40"
              />
            </label>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredChapters.map((item) => {
              const active = item.chapter === chapterNumber;
              const cardFocus = chapterMenu.find((chapterItem) => chapterItem.chapter === item.chapter)?.focus ?? item.revelation;

              return (
                <button
                  key={item.chapter}
                  type="button"
                  onClick={() => updateQuery(item.chapter, translationSlug, true)}
                  className={`rounded-[1.5rem] border p-5 text-left transition hover:-translate-y-0.5 ${active ? "border-amber-500/40 bg-amber-50 shadow-[0_16px_36px_-24px_rgba(217,119,6,0.5)]" : "border-stone-900/8 bg-stone-50 hover:border-amber-500/25 hover:bg-white"}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-stone-950">{item.name}</p>
                      <p className="mt-1 text-sm text-stone-500">{item.arabicname}</p>
                    </div>
                    <span className="rounded-full bg-stone-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-white">{item.chapter}</span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-stone-600">{cardFocus}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section id="translations" className="grid gap-6 lg:grid-cols-[0.94fr_1.06fr]">
          <article className="rounded-[2rem] border border-stone-900/10 bg-[linear-gradient(180deg,_rgba(255,251,240,0.92),_rgba(244,236,220,0.92))] p-6 shadow-[0_18px_50px_-34px_rgba(28,25,23,0.45)] sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-stone-500">Translation menu</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">Switch the reading voice without changing the chapter.</h3>
            <p className="mt-3 text-sm leading-7 text-stone-700">
              The menu uses Quran API edition slugs, so each selection loads the same chapter with a different translation.
            </p>

            <div className="mt-6 space-y-3">
              {translationMenu.map((item) => {
                const active = item.slug === translationSlug;

                return (
                  <button
                    key={item.slug}
                    type="button"
                    onClick={() => updateQuery(chapterNumber, item.slug)}
                    className={`flex w-full items-center justify-between gap-4 rounded-[1.3rem] border px-4 py-4 text-left transition hover:-translate-y-0.5 ${active ? "border-amber-500/40 bg-amber-50" : "border-stone-900/8 bg-white/80 hover:border-amber-500/25 hover:bg-white"}`}
                  >
                    <div>
                      <p className="font-semibold text-stone-950">{item.label}</p>
                      <p className="mt-1 text-sm text-stone-600">{item.description}</p>
                    </div>
                    <span className="rounded-full bg-stone-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-white">
                      {active ? "Selected" : "Open"}
                    </span>
                  </button>
                );
              })}
            </div>
          </article>

          <article id="reader" className="rounded-[2rem] border border-stone-900/10 bg-white/84 p-6 shadow-[0_18px_50px_-34px_rgba(28,25,23,0.45)] backdrop-blur-sm sm:p-7">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-stone-500">Reader</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">{selectedChapterCard.name} with Arabic, translation, and ayah actions.</h3>
              </div>
              <p className="text-sm text-stone-600">{previewVerses.length} verses</p>
            </div>

            <div className="mt-6 grid gap-4">
              {previewVerses.map((verse) => {
                const bookmarkKey = `${chapterNumber}:${verse.verseNumber}`;
                const isBookmarked = bookmarks.has(bookmarkKey);
                const isRead = progress.has(bookmarkKey);

                return (
                  <article
                    key={verse.verseNumber}
                    className="rounded-[1.5rem] border border-stone-900/8 bg-stone-50 p-5 transition hover:-translate-y-0.5 hover:border-amber-500/25 hover:bg-white"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="rounded-full bg-stone-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-white">
                        Ayah {verse.verseNumber}
                      </span>
                      <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                        {isRead ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-900">Read</span> : null}
                        {isBookmarked ? <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">Bookmarked</span> : null}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
                      <p dir="rtl" lang="ar" className="text-right text-2xl leading-[2] text-stone-950 sm:text-3xl">{verse.arabic}</p>
                      <p className="text-base leading-8 text-stone-700 sm:text-lg">{verse.translation}</p>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3 text-sm font-medium">
                      <button
                        type="button"
                        onClick={() => playVerse(verse.verseNumber)}
                        className="rounded-full bg-stone-950 px-4 py-2 text-white transition hover:bg-stone-800"
                      >
                        Play recitation
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleBookmark(verse.verseNumber)}
                        className="rounded-full border border-stone-900/10 bg-white px-4 py-2 text-stone-800 transition hover:border-amber-500/30 hover:text-stone-950"
                      >
                        {isBookmarked ? "Remove bookmark" : "Bookmark verse"}
                      </button>
                      <button
                        type="button"
                        onClick={() => markProgress(verse.verseNumber)}
                        className="rounded-full border border-stone-900/10 bg-white px-4 py-2 text-stone-800 transition hover:border-emerald-500/30 hover:text-stone-950"
                      >
                        Mark as read
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </article>
        </section>

        <section id="personalized" className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-[2rem] border border-stone-900/10 bg-white/84 p-6 shadow-[0_18px_50px_-34px_rgba(28,25,23,0.45)] backdrop-blur-sm sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-stone-500">Account</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">Sign up for sync and learning history.</h3>
              </div>
              <span className="rounded-full bg-stone-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-white">
                {BACKEND_HINT}
              </span>
            </div>

            <p className="mt-4 text-sm leading-7 text-stone-600">{authStatus}</p>

            <div className="mt-5 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">Email</span>
                  <input
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none focus:border-amber-500/40"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">Password</span>
                  <input
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    type="password"
                    placeholder="Password"
                    className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none focus:border-amber-500/40"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-3 text-sm font-medium">
                <button type="button" onClick={handleAuthSubmit} className="rounded-full bg-stone-950 px-4 py-2 text-white transition hover:bg-stone-800">
                  {authMode === "signin" ? "Sign in" : "Create account"}
                </button>
                <button type="button" onClick={() => setAuthMode(authMode === "signin" ? "signup" : "signin")} className="rounded-full border border-stone-900/10 bg-white px-4 py-2 text-stone-800 transition hover:border-amber-500/30 hover:text-stone-950">
                  Switch to {authMode === "signin" ? "signup" : "sign in"}
                </button>
                {session ? (
                  <button type="button" onClick={handleSignOut} className="rounded-full border border-emerald-500/30 bg-emerald-50 px-4 py-2 text-emerald-900 transition hover:bg-emerald-100">
                    Sign out
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">Display name</span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Your reading name"
                  className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none focus:border-amber-500/40"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">Daily goal</span>
                <input
                  value={goalInput}
                  onChange={(event) => setGoalInput(event.target.value)}
                  type="number"
                  min="1"
                  className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none focus:border-amber-500/40"
                />
              </label>
            </div>

            <label className="mt-4 grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">Learning theme</span>
              <input
                value={learningTheme}
                onChange={(event) => setLearningTheme(event.target.value)}
                placeholder="Mercy, patience, gratitude, consistency..."
                className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none focus:border-amber-500/40"
              />
            </label>

            <button type="button" onClick={saveProfile} className="mt-5 rounded-full bg-amber-400 px-5 py-3 text-sm font-medium text-stone-950 transition hover:bg-amber-300">
              Save profile
            </button>
          </article>

          <article className="rounded-[2rem] border border-stone-900/10 bg-[linear-gradient(180deg,_rgba(255,251,240,0.94),_rgba(244,236,220,0.95))] p-6 shadow-[0_18px_50px_-34px_rgba(28,25,23,0.45)] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-stone-500">For you</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">Personalized learning that brings people back.</h3>
              </div>
              <span className="rounded-full border border-stone-900/10 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-stone-700">
                {session ? "Synced" : "Local"}
              </span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.4rem] border border-stone-900/8 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">Current streak</p>
                <p className="mt-2 text-3xl font-semibold text-stone-950">{profile?.streak_count ?? DEMO_PROFILE.streak_count}</p>
              </div>
              <div className="rounded-[1.4rem] border border-stone-900/8 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">Favorite chapter</p>
                <p className="mt-2 text-lg font-semibold text-stone-950">{getChapterLabel(profile?.favorite_chapter ?? chapterNumber)}</p>
              </div>
              <div className="rounded-[1.4rem] border border-stone-900/8 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">Daily goal</p>
                <p className="mt-2 text-3xl font-semibold text-stone-950">{profile?.daily_goal ?? 7}</p>
              </div>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-stone-900/8 bg-stone-950 p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-300/90">Recommended return</p>
              <h4 className="mt-3 text-2xl font-semibold">{getRecommendedChapter(profile, chapterNumber).name}</h4>
              <p className="mt-2 text-sm leading-7 text-stone-300">
                {getRecommendedChapter(profile, chapterNumber).focus}. Return here tomorrow to continue the same learning trail.
              </p>
            </div>
            <div className="mt-4 rounded-[1.5rem] border border-stone-900/8 bg-white/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-stone-500">Latest visit</p>
              <p className="mt-2 text-lg font-semibold text-stone-950">{profile?.last_seen_at ? formatRelativeTime(profile.last_seen_at) : "No saved visit yet"}</p>
              <p className="mt-2 text-sm leading-7 text-stone-600">Keep returning to build the habit and the recommendation engine gets more personal.</p>
            </div>
          </article>
        </section>

        <section id="community" className="rounded-[2rem] border border-stone-900/10 bg-white/84 p-6 shadow-[0_18px_50px_-34px_rgba(28,25,23,0.45)] backdrop-blur-sm sm:p-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-stone-500">Community learning</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">A shared circle to keep people coming back.</h3>
            </div>
            <p className="text-sm text-stone-600">{communityPosts.length} recent reflections</p>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[1.8rem] border border-stone-900/8 bg-stone-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-stone-500">Post a reflection</p>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">Chapter</span>
                  <input
                    value={communityChapter}
                    onChange={(event) => setCommunityChapter(event.target.value)}
                    type="number"
                    min="1"
                    max="114"
                    className="rounded-2xl border border-stone-900/10 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-amber-500/40"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">Verse</span>
                  <input
                    value={communityVerse}
                    onChange={(event) => setCommunityVerse(event.target.value)}
                    type="number"
                    min="1"
                    placeholder="Optional"
                    className="rounded-2xl border border-stone-900/10 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-amber-500/40"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">Reflection</span>
                  <textarea
                    value={communityDraft}
                    onChange={(event) => setCommunityDraft(event.target.value)}
                    rows={5}
                    placeholder="Write a short thought, question, or intention..."
                    className="rounded-2xl border border-stone-900/10 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-amber-500/40"
                  />
                </label>
              </div>
              <button type="button" onClick={publishCommunityPost} className="mt-4 rounded-full bg-stone-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-800">
                Share to community
              </button>
            </div>

            <div className="grid gap-4">
              {communityPosts.map((post) => (
                <article key={post.id} className="rounded-[1.5rem] border border-stone-900/8 bg-stone-50 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-stone-950">{post.display_name}</p>
                      <p className="text-sm text-stone-500">{getChapterLabel(post.chapter)} {post.verse ? ` - Verse ${post.verse}` : ""}</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-amber-900">
                      {post.likes_count} likes
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-stone-700">{post.body}</p>
                  <p className="mt-3 text-xs font-medium uppercase tracking-[0.28em] text-stone-500">{formatRelativeTime(post.created_at)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-stone-900/10 bg-stone-950 p-6 text-white shadow-[0_18px_50px_-34px_rgba(28,25,23,0.82)]">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-300/90">Reading plan</p>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight">Use the menus to move without losing context.</h3>
          <p className="mt-3 text-sm leading-7 text-stone-300">
            Chapters are searchable, translations are swappable, bookmarks persist in your browser, and audio playback is attached to the selected verse. With Supabase connected, signups, saved profiles, and community posts are stored in the backend too.
          </p>
        </section>

      </section>
    </main>
  );
}
