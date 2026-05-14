import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronDown, LayoutGrid, List } from "lucide-react";
import type { Note, SortOption, FilterState } from "@/types";
import { mockFaculties } from "@/data/mockData";
import { getNotes, voteNote } from "@/services/api";
import { NoteCard } from "@/components/notes/NoteCard";
import { NoteListItem } from "@/components/notes/NoteListItem";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Shared trigger style: no border, full width
const filterTrigger =
  "w-full text-sm bg-zinc-50 border-0 data-[placeholder]:text-zinc-400";

export function BrowsePage() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState<Note[]>([]);
  const [filters, setFilters] = useState<FilterState>({ faculty: "", department: "", course: "" });
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "card">("card");

  useEffect(() => {
    getNotes().then(setNotes);
  }, []);

  const availableDepartments = filters.faculty
    ? mockFaculties.find((f) => f.name === filters.faculty)?.departments ?? []
    : [];

  const availableCourses = filters.department
    ? availableDepartments.find((d) => d.name === filters.department)?.courses ?? []
    : [];

  const filteredNotes = notes
    .filter((note) => {
      if (filters.faculty && note.faculty !== filters.faculty) return false;
      if (filters.department && note.department !== filters.department) return false;
      if (filters.course && note.courseName !== filters.course) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          note.courseName.toLowerCase().includes(q) ||
          note.professorName.toLowerCase().includes(q) ||
          note.uploader.username.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "recent") return b.uploadDate.getTime() - a.uploadDate.getTime();
      if (sortBy === "upvoted") return b.netScore - a.netScore;
      if (sortBy === "name") return a.courseName.localeCompare(b.courseName);
      return 0;
    });

  const clearFilters = () => setFilters({ faculty: "", department: "", course: "" });
  const hasActiveFilters = filters.faculty || filters.department || filters.course;

  const handleVote = async (id: string, type: "up" | "down") => {
    const result = await voteNote(id, type);
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        return { 
          ...n, 
          upvotes: result.upvotes, 
          downvotes: result.downvotes, 
          netScore: result.netScore 
        };
      })
    );
};

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-10">
        <div>
          <h1 className="text-2xl font-medium text-zinc-900 mb-1">Find notes</h1>
          <p className="text-zinc-500 text-sm">Search by course, professor, or uploader.</p>
        </div>
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-100 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 transition-all"
          />
        </div>
      </div>

      {/* Controls bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors duration-150 cursor-pointer"
          >
            Filters
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-150", showFilters && "rotate-180")} />
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors duration-150 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center bg-zinc-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("card")}
              className={cn("p-1.5 rounded-md transition-all duration-150 cursor-pointer", viewMode === "card" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-400 hover:text-zinc-600")}
              aria-label="Card view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn("p-1.5 rounded-md transition-all duration-150 cursor-pointer", viewMode === "list" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-400 hover:text-zinc-600")}
              aria-label="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Sort — popper so it drops below the trigger */}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-36 text-sm text-zinc-500 bg-transparent border-0 shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={6} align="end">
              <SelectItem value="recent">Most recent</SelectItem>
              <SelectItem value="upvoted">Most upvoted</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
            <div>
              <label className="text-xs text-zinc-400 uppercase tracking-wide mb-1.5 block">Faculty</label>
              <Select
                value={filters.faculty || undefined}
                onValueChange={(v) => setFilters({ faculty: v, department: "", course: "" })}
              >
                <SelectTrigger className={filterTrigger}>
                  <SelectValue placeholder="All faculties" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={6}>
                  {mockFaculties.map((f) => (
                    <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-zinc-400 uppercase tracking-wide mb-1.5 block">Department</label>
              <Select
                value={filters.department || undefined}
                onValueChange={(v) => setFilters((prev) => ({ ...prev, department: v, course: "" }))}
                disabled={!filters.faculty}
              >
                <SelectTrigger className={filterTrigger}>
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={6}>
                  {availableDepartments.map((d) => (
                    <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-zinc-400 uppercase tracking-wide mb-1.5 block">Course</label>
              <Select
                value={filters.course || undefined}
                onValueChange={(v) => setFilters((prev) => ({ ...prev, course: v }))}
                disabled={!filters.department}
              >
                <SelectTrigger className={filterTrigger}>
                  <SelectValue placeholder="All courses" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={6}>
                  {availableCourses.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Count */}
      <p className="text-sm text-zinc-400 mb-6">{filteredNotes.length} notes</p>

      {/* Notes grid / list */}
      {filteredNotes.length > 0 ? (
        viewMode === "card" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onVote={handleVote}
                onClick={() => navigate(`/notes/${note.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="max-w-3xl">
            {filteredNotes.map((note) => (
              <NoteListItem
                key={note.id}
                note={note}
                onVote={handleVote}
                onClick={() => navigate(`/notes/${note.id}`)}
              />
            ))}
          </div>
        )
      ) : (
        <div className="py-20 text-center">
          <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-6 h-6 text-zinc-300" />
          </div>
          <p className="text-zinc-400 mb-3 text-sm">No notes found</p>
          <button
            onClick={clearFilters}
            className="text-sm text-orange-600 hover:underline cursor-pointer"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
