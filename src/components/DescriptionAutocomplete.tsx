"use client";
import { useState, useRef, useEffect } from "react";
import { TimeEntry } from "@/types/supabase";
import { getMyRecentEntries } from "@/utils/supabase/timeApi";
import { useAuth } from "@/context/AuthContext";

interface Props {
  value: string;
  onChange: (val: string, projectId?: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export default function DescriptionAutocomplete({ value, onChange, disabled, placeholder, className }: Props) {
  const { user } = useAuth();
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) getMyRecentEntries(user.id).then(setRecentEntries);
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const suggestions = recentEntries
    .filter((e) => e.description && e.description.toLowerCase().includes(value.toLowerCase()))
    .reduce((acc, current) => {
      const x = acc.find((item) => item.description === current.description && item.project_id === current.project_id);
      if (!x) acc.push(current);
      return acc;
    }, [] as TimeEntry[])
    .slice(0, 5);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [value, showSuggestions]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter" && highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
      e.preventDefault();
      const selected = suggestions[highlightedIndex];
      onChange(selected.description || "", selected.project_id);
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div className="relative w-full" ref={suggestionsRef}>
      <input
        type="text"
        maxLength={500}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
      />
      {showSuggestions && suggestions.length > 0 && !disabled && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg overflow-hidden z-50">
          {suggestions.map((s, idx) => (
            <div
              key={idx}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHighlightedIndex(idx)}
              onClick={() => {
                onChange(s.description || "", s.project_id);
                setShowSuggestions(false);
                setHighlightedIndex(-1);
              }}
              className={`px-4 py-2 cursor-pointer border-b border-zinc-100 dark:border-zinc-800 last:border-0 ${
                idx === highlightedIndex ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{s.description}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2 mt-0.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.projects?.color_hex || "#ccc" }} />
                {s.projects?.name || "No Project"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
