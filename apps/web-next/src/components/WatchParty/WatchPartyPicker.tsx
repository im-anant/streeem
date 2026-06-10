"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Search,
  X,
  Check,
  Film,
  Tv,
  ChevronDown,
  Sparkles,
  Popcorn,
  AlertCircle,
  Play,
} from "lucide-react";
import { clsx } from "clsx";

// ─── Types ───────────────────────────────────────────────────

interface TMDBResult {
  id: number;
  title?: string;
  name?: string;
  media_type: "movie" | "tv" | "person";
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  vote_average?: number;
}

interface Season {
  season_number: number;
  name: string;
  episode_count: number;
}

interface Episode {
  episode_number: number;
  name: string;
  overview?: string;
  still_path?: string;
}

export interface WatchPartyPickerProps {
  open: boolean;
  onClose: () => void;
  onStart: (data: {
    contentType: "movie" | "tv";
    tmdbId: number;
    season?: number;
    episode?: number;
    embedUrl: string;
    title: string;
    posterPath?: string;
  }) => void;
}

// ─── Constants ───────────────────────────────────────────────

const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_KEY || "";
const TMDB_BASE = "https://api.themoviedb.org/3";
const POSTER_BASE = "https://image.tmdb.org/t/p/w300";
const EMBED_BASE = "https://www.vidking.net/embed";
const DEBOUNCE_MS = 300;

// ─── Helpers ─────────────────────────────────────────────────

function getYear(result: TMDBResult): string {
  const date = result.release_date || result.first_air_date;
  return date ? date.slice(0, 4) : "";
}

function getTitle(result: TMDBResult): string {
  return result.title || result.name || "Untitled";
}

function buildEmbedUrl(
  type: "movie" | "tv",
  tmdbId: number,
  season?: number,
  episode?: number
): string {
  if (type === "movie") return `${EMBED_BASE}/movie/${tmdbId}`;
  return `${EMBED_BASE}/tv/${tmdbId}/${season}/${episode}`;
}

// ─── Skeleton Card ───────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-2 animate-pulse">
      <div className="aspect-[2/3] rounded-xl bg-white/5" />
      <div className="h-3 w-3/4 rounded bg-white/5" />
      <div className="h-2.5 w-1/3 rounded bg-white/5" />
    </div>
  );
}

// ─── Result Card ─────────────────────────────────────────────

function ResultCard({
  result,
  isSelected,
  onSelect,
}: {
  result: TMDBResult;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const title = getTitle(result);
  const year = getYear(result);
  const isMovie = result.media_type === "movie";

  return (
    <button
      onClick={onSelect}
      className={clsx(
        "group relative flex flex-col text-left rounded-xl overflow-hidden",
        "transition-all duration-200 ease-out",
        "hover:scale-[1.03] hover:z-10",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
        isSelected
          ? "ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/20"
          : "ring-1 ring-white/5 hover:ring-white/15"
      )}
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] bg-neutral-800 overflow-hidden">
        {result.poster_path ? (
          <img
            src={`${POSTER_BASE}${result.poster_path}`}
            alt={title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-neutral-800">
            <Film className="w-10 h-10 text-white/10" />
          </div>
        )}

        {/* Hover overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

        {/* Type badge */}
        <span
          className={clsx(
            "absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider",
            "px-2 py-0.5 rounded-md backdrop-blur-md",
            isMovie
              ? "bg-purple-500/20 text-purple-300 border border-purple-400/20"
              : "bg-sky-500/20 text-sky-300 border border-sky-400/20"
          )}
        >
          {isMovie ? "Movie" : "TV"}
        </span>

        {/* Selected checkmark */}
        {isSelected && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
            <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center shadow-xl shadow-indigo-500/30">
              <Check className="w-6 h-6 text-white" strokeWidth={3} />
            </div>
          </div>
        )}

        {/* Rating badge */}
        {result.vote_average != null && result.vote_average > 0 && (
          <span className="absolute top-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-black/50 backdrop-blur-md text-amber-400 border border-amber-500/20">
            ★ {result.vote_average.toFixed(1)}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 bg-neutral-900/80">
        <h3 className="text-sm font-medium text-white/90 truncate leading-snug">
          {title}
        </h3>
        {year && (
          <p className="text-xs text-white/40 mt-0.5">{year}</p>
        )}
      </div>
    </button>
  );
}

// ─── TV Season / Episode Picker ──────────────────────────────

function TVPicker({
  tmdbId,
  onSelect,
  onBack,
}: {
  tmdbId: number;
  onSelect: (season: number, episode: number) => void;
  onBack: () => void;
}) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch seasons
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`${TMDB_BASE}/tv/${tmdbId}?api_key=${TMDB_KEY}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const validSeasons = (data.seasons || []).filter(
          (s: Season) => s.season_number > 0 && s.episode_count > 0
        );
        setSeasons(validSeasons);
        if (validSeasons.length > 0) {
          setSelectedSeason(validSeasons[0].season_number);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tmdbId]);

  // Fetch episodes when season changes
  useEffect(() => {
    if (selectedSeason == null) return;
    let cancelled = false;

    fetch(
      `${TMDB_BASE}/tv/${tmdbId}/season/${selectedSeason}?api_key=${TMDB_KEY}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setEpisodes(data.episodes || []);
        setSelectedEpisode(null);
      })
      .catch(() => {
        if (!cancelled) setEpisodes([]);
      });

    return () => {
      cancelled = true;
    };
  }, [tmdbId, selectedSeason]);

  // Notify parent when both season + episode selected
  useEffect(() => {
    if (selectedSeason != null && selectedEpisode != null) {
      onSelect(selectedSeason, selectedEpisode);
    }
  }, [selectedSeason, selectedEpisode, onSelect]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Back button */}
      <button
        onClick={onBack}
        className="text-sm text-white/50 hover:text-white/80 transition-colors flex items-center gap-1"
      >
        ← Back to search
      </button>

      {/* Season selector */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
          Season
        </label>
        <div className="relative">
          <select
            value={selectedSeason ?? ""}
            onChange={(e) => setSelectedSeason(Number(e.target.value))}
            className={clsx(
              "w-full appearance-none rounded-xl px-4 py-3",
              "bg-white/5 border border-white/10",
              "text-white text-sm font-medium",
              "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
              "transition-all cursor-pointer"
            )}
          >
            {seasons.map((s) => (
              <option
                key={s.season_number}
                value={s.season_number}
                className="bg-neutral-900 text-white"
              >
                {s.name} ({s.episode_count} episodes)
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
        </div>
      </div>

      {/* Episode list */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
          Episode
        </label>
        <div className="max-h-64 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
          {episodes.map((ep) => (
            <button
              key={ep.episode_number}
              onClick={() => setSelectedEpisode(ep.episode_number)}
              className={clsx(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left",
                "transition-all duration-150",
                selectedEpisode === ep.episode_number
                  ? "bg-indigo-500/15 ring-1 ring-indigo-500/50 text-white"
                  : "bg-white/[0.03] hover:bg-white/[0.06] text-white/70 hover:text-white"
              )}
            >
              <span
                className={clsx(
                  "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                  selectedEpisode === ep.episode_number
                    ? "bg-indigo-500 text-white"
                    : "bg-white/5 text-white/40"
                )}
              >
                {ep.episode_number}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{ep.name}</p>
                {ep.overview && (
                  <p className="text-xs text-white/30 truncate mt-0.5">
                    {ep.overview}
                  </p>
                )}
              </div>
              {selectedEpisode === ep.episode_number && (
                <Check className="w-4 h-4 text-indigo-400 shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────

export function WatchPartyPicker({
  open,
  onClose,
  onStart,
}: WatchPartyPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TMDBResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedResult, setSelectedResult] = useState<TMDBResult | null>(null);
  const [showTVPicker, setShowTVPicker] = useState(false);
  const [tvSelection, setTVSelection] = useState<{
    season: number;
    episode: number;
  } | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Missing API key ────────────────────────────────────────
  const missingKey = !TMDB_KEY;

  // ── Debounced search ───────────────────────────────────────
  const searchTMDB = useCallback(async (q: string) => {
    if (!q.trim() || !TMDB_KEY) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(
        `${TMDB_BASE}/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(q.trim())}`
      );
      const data = await res.json();
      const filtered = (data.results || []).filter(
        (r: TMDBResult) =>
          (r.media_type === "movie" || r.media_type === "tv") &&
          r.poster_path // only show results with posters for better UX
      );
      setResults(filtered);
      setHasSearched(true);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    debounceRef.current = setTimeout(() => {
      searchTMDB(query);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, searchTMDB]);

  // ── Focus search on open ───────────────────────────────────
  useEffect(() => {
    if (open) {
      // Small delay for animation
      const t = setTimeout(() => searchRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
    // Reset state on close
    setQuery("");
    setResults([]);
    setSelectedResult(null);
    setShowTVPicker(false);
    setTVSelection(null);
    setHasSearched(false);
  }, [open]);

  // ── Keyboard shortcuts ─────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (showTVPicker) {
          setShowTVPicker(false);
          setTVSelection(null);
        } else {
          onClose();
        }
      }
      // Enter on single result
      if (e.key === "Enter" && results.length === 1 && !selectedResult) {
        handleResultSelect(results[0]);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, results, selectedResult, showTVPicker, onClose]);

  // ── Select a result ────────────────────────────────────────
  const handleResultSelect = useCallback((result: TMDBResult) => {
    setSelectedResult(result);
    if (result.media_type === "tv") {
      setShowTVPicker(true);
      setTVSelection(null);
    } else {
      setShowTVPicker(false);
      setTVSelection(null);
    }
  }, []);

  // ── TV episode selection ───────────────────────────────────
  const handleTVSelect = useCallback((season: number, episode: number) => {
    setTVSelection({ season, episode });
  }, []);

  // ── Start watch party ──────────────────────────────────────
  const canStart = useMemo(() => {
    if (!selectedResult) return false;
    if (selectedResult.media_type === "movie") return true;
    return tvSelection != null;
  }, [selectedResult, tvSelection]);

  const handleStart = useCallback(() => {
    if (!selectedResult || !canStart) return;

    const type = selectedResult.media_type as "movie" | "tv";
    const embedUrl = buildEmbedUrl(
      type,
      selectedResult.id,
      tvSelection?.season,
      tvSelection?.episode
    );

    onStart({
      contentType: type,
      tmdbId: selectedResult.id,
      season: tvSelection?.season,
      episode: tvSelection?.episode,
      embedUrl,
      title: getTitle(selectedResult),
      posterPath: selectedResult.poster_path || undefined,
    });
  }, [selectedResult, tvSelection, canStart, onStart]);

  // ── Render ─────────────────────────────────────────────────
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={clsx(
          "relative z-10 w-full max-w-4xl mx-4 mt-[5vh] mb-32",
          "max-h-[85vh] flex flex-col",
          "bg-neutral-950/90 backdrop-blur-2xl",
          "border border-white/[0.08] rounded-2xl",
          "shadow-2xl shadow-black/50",
          "animate-in slide-in-from-bottom-4 fade-in duration-300"
        )}
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 pt-5 pb-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Popcorn className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white tracking-tight">
                Watch Party
              </h2>
              <p className="text-xs text-white/40">
                Search for a movie or TV show to watch together
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* ── Missing API Key Warning ─────────────────────────── */}
        {missingKey && (
          <div className="mx-6 mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-300">
                TMDB API key not configured
              </p>
              <p className="text-xs text-amber-400/60 mt-1">
                Set the <code className="bg-amber-500/10 px-1.5 py-0.5 rounded text-amber-300">NEXT_PUBLIC_TMDB_KEY</code> environment
                variable to enable content search.
              </p>
            </div>
          </div>
        )}

        {/* ── Search Bar ──────────────────────────────────────── */}
        {!showTVPicker && (
          <div className="px-6 py-4">
            <div
              className={clsx(
                "relative flex items-center",
                "bg-white/[0.04] border border-white/[0.08]",
                "rounded-xl overflow-hidden",
                "focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500/30",
                "transition-all duration-200"
              )}
            >
              <Search className="w-5 h-5 text-white/30 ml-4 shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search movies & TV shows…"
                disabled={missingKey}
                className={clsx(
                  "flex-1 bg-transparent px-3 py-3.5",
                  "text-white text-sm placeholder:text-white/25",
                  "focus:outline-none",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="mr-3 p-1 rounded-md hover:bg-white/5 transition-colors"
                >
                  <X className="w-4 h-4 text-white/30" />
                </button>
              )}
              {isSearching && (
                <div className="mr-4">
                  <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Content Area ────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 custom-scrollbar">
          {showTVPicker && selectedResult ? (
            /* TV Picker */
            <div className="pb-2">
              <div className="flex items-center gap-3 mb-5">
                {selectedResult.poster_path && (
                  <img
                    src={`${POSTER_BASE}${selectedResult.poster_path}`}
                    alt=""
                    className="w-12 h-[72px] rounded-lg object-cover ring-1 ring-white/10"
                  />
                )}
                <div>
                  <h3 className="text-base font-semibold text-white">
                    {getTitle(selectedResult)}
                  </h3>
                  <p className="text-xs text-white/40 mt-0.5">
                    Select a season and episode
                  </p>
                </div>
              </div>
              <TVPicker
                tmdbId={selectedResult.id}
                onSelect={handleTVSelect}
                onBack={() => {
                  setShowTVPicker(false);
                  setTVSelection(null);
                }}
              />
            </div>
          ) : isSearching && results.length === 0 ? (
            /* Loading skeleton */
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : results.length > 0 ? (
            /* Results grid */
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {results.map((result) => (
                <ResultCard
                  key={`${result.media_type}-${result.id}`}
                  result={result}
                  isSelected={selectedResult?.id === result.id}
                  onSelect={() => handleResultSelect(result)}
                />
              ))}
            </div>
          ) : hasSearched && !isSearching ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4">
                <Film className="w-8 h-8 text-white/10" />
              </div>
              <p className="text-white/40 text-sm font-medium">
                No results found
              </p>
              <p className="text-white/20 text-xs mt-1">
                Try a different search term
              </p>
            </div>
          ) : (
            /* Initial state */
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center mb-5 border border-white/[0.04]">
                <Sparkles className="w-9 h-9 text-indigo-400/60" />
              </div>
              <p className="text-white/50 text-sm font-medium">
                Search for something to watch
              </p>
              <p className="text-white/20 text-xs mt-1.5 max-w-xs">
                Find a movie or TV show and start a watch party with everyone in the room
              </p>
            </div>
          )}
        </div>

        {/* ── Footer / CTA ────────────────────────────────────── */}
        {selectedResult && (
          <div className="px-6 py-4 border-t border-white/[0.05]">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {selectedResult.poster_path && !showTVPicker && (
                  <img
                    src={`${POSTER_BASE}${selectedResult.poster_path}`}
                    alt=""
                    className="w-10 h-[60px] rounded-lg object-cover ring-1 ring-white/10 shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {getTitle(selectedResult)}
                  </p>
                  <p className="text-xs text-white/40">
                    {selectedResult.media_type === "movie"
                      ? `Movie · ${getYear(selectedResult)}`
                      : tvSelection
                      ? `S${tvSelection.season} E${tvSelection.episode}`
                      : "Select an episode"}
                  </p>
                </div>
              </div>

              <button
                onClick={handleStart}
                disabled={!canStart}
                className={clsx(
                  "inline-flex items-center gap-2 px-6 py-3 rounded-xl",
                  "text-sm font-semibold transition-all duration-200",
                  "shrink-0",
                  canStart
                    ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-400 hover:to-purple-500 hover:scale-105 active:scale-95 shadow-lg shadow-indigo-500/25"
                    : "bg-white/5 text-white/20 cursor-not-allowed"
                )}
              >
                <Play className="w-4 h-4" />
                Start Watch Party
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
