import { useState } from "react";
import type { Note, User, SortOption, FilterState } from "@/types";
import { mockNotes, mockUsers, mockFaculties, getUserByUsername, getNotesByUploader } from "@/data/mockData";
import {
  ArrowUp,
  ArrowDown,
  Search,
  Upload,
  FileText,
  Image,
  File,
  Menu,
  Download,
  ChevronLeft,
  BookOpen,
  GraduationCap,
  Building2,
  ChevronDown,
  LayoutGrid,
  List,
} from "lucide-react";
import { format } from "date-fns";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function FileTypeIcon({ type, className }: { type: string; className?: string }) {
  if (type === "PDF") return <FileText className={cn("text-gray-400", className)} />;
  if (type === "Image") return <Image className={cn("text-gray-400", className)} />;
  return <File className={cn("text-gray-400", className)} />;
}

// Modern minimal navbar
function Navigation({
  currentView,
  onNavigate,
}: {
  currentView: string;
  onNavigate: (view: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <button
            onClick={() => onNavigate("browse")}
            className="flex items-center gap-2.5 text-gray-900 hover:opacity-70 transition-opacity"
          >
            <span className="font-semibold text-sm tracking-tight">Waseda Notes</span>
          </button>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center">
            <div className="flex items-center bg-gray-100/80 rounded-full p-1">
              <button
                onClick={() => onNavigate("browse")}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                  currentView === "browse"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-400 hover:text-gray-700"
                )}
              >
                Browse
              </button>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate("profile")}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              Sign in
            </button>
            <button
              onClick={() => onNavigate("upload")}
              className="hidden md:inline-flex bg-gray-900 text-white text-xs px-3 py-1.5 rounded-md hover:bg-gray-800 transition-colors"
            >
              Upload
            </button>
            <button 
              onClick={() => setIsOpen(!isOpen)} 
              className="md:hidden w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            >
              <Menu className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white/95 backdrop-blur-sm">
          <div className="px-4 py-2 space-y-1">
            <button
              onClick={() => { onNavigate("browse"); setIsOpen(false); }}
              className={cn(
                "block w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors",
                currentView === "browse"
                  ? "text-gray-900 font-medium"
                  : "text-gray-400 hover:text-gray-700"
              )}
            >
              Browse
            </button>
            <button
              onClick={() => { onNavigate("upload"); setIsOpen(false); }}
              className={cn(
                "block w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors",
                currentView === "upload"
                  ? "text-gray-900 font-medium"
                  : "text-gray-400 hover:text-gray-700"
              )}
            >
              Upload
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}

// List view item
function NoteListItem({
  note,
  onVote,
  onClick,
}: {
  note: Note;
  onVote: (id: string, type: "up" | "down") => void;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="group py-2.5 border-b border-gray-100 cursor-pointer hover:bg-gray-50/50 transition-colors -mx-3 px-3"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-medium text-gray-900 group-hover:text-orange-600 transition-colors">
              {note.courseName}
            </h3>
            <span className="text-xs text-gray-400">{note.fileType}</span>
          </div>
          <p className="text-xs text-gray-400 mb-0.5">{note.professorName}</p>
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <span>@{note.uploader.username}</span>
            <span>·</span>
            <span>{format(note.uploadDate, "MMM d")}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onVote(note.id, "up");
            }}
            className="p-1.5 text-gray-400 hover:text-orange-600 transition-colors"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <span className={cn(
            "text-sm font-medium min-w-[24px] text-center",
            note.netScore > 0 ? "text-orange-600" : "text-gray-400"
          )}>
            {note.netScore}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onVote(note.id, "down");
            }}
            className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Card view item with preview
function NoteCardItem({
  note,
  onVote,
  onClick,
}: {
  note: Note;
  onVote: (id: string, type: "up" | "down") => void;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
    >
      {/* Preview area */}
      <div className="h-24 bg-gray-100 flex items-center justify-center">
        <FileTypeIcon type={note.fileType} className="w-8 h-8 text-gray-300" />
      </div>
      
      {/* Content */}
      <div className="p-3">
        <h3 className="text-sm font-medium text-gray-900 leading-snug group-hover:text-orange-600 transition-colors truncate mb-1">
          {note.courseName}
        </h3>
        
        <p className="text-xs text-gray-400 mb-2.5">{note.professorName}</p>
        
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">@{note.uploader.username}</span>
          
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onVote(note.id, "up");
              }}
              className="p-1 text-gray-400 hover:text-orange-600 transition-colors"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <span className={cn(
              "text-xs font-medium",
              note.netScore > 0 ? "text-orange-600" : "text-gray-400"
            )}>
              {note.netScore}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BrowsePage({
  notes,
  onVote,
  onNoteClick,
}: {
  notes: Note[];
  onVote: (id: string, type: "up" | "down") => void;
  onNoteClick: (note: Note) => void;
}) {
  const [filters, setFilters] = useState<FilterState>({
    faculty: "",
    department: "",
    course: "",
  });
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "card">("card");

  const availableDepartments = filters.faculty
    ? mockFaculties.find((f) => f.name === filters.faculty)?.departments || []
    : [];

  const availableCourses = filters.department
    ? availableDepartments.find((d) => d.name === filters.department)?.courses || []
    : [];

  const filteredNotes = notes
    .filter((note) => {
      if (filters.faculty && note.faculty !== filters.faculty) return false;
      if (filters.department && note.department !== filters.department) return false;
      if (filters.course && note.courseName !== filters.course) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          note.courseName.toLowerCase().includes(query) ||
          note.professorName.toLowerCase().includes(query) ||
          note.uploader.username.toLowerCase().includes(query)
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

  const clearFilters = () => {
    setFilters({ faculty: "", department: "", course: "" });
  };

  const hasActiveFilters = filters.faculty || filters.department || filters.course;

  return (
    <div className="min-h-screen bg-[#f7f7f5] pt-14">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header with search on same row */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Find notes</h1>
            <p className="text-gray-500 text-sm">Search by course, professor, or topic.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Controls bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              Filters
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showFilters && "rotate-180")} />
            </button>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-gray-600">
                Clear
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {/* View toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode("card")}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  viewMode === "card" ? "bg-white shadow-sm text-gray-900" : "text-gray-400 hover:text-gray-600"
                )}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  viewMode === "list" ? "bg-white shadow-sm text-gray-900" : "text-gray-400 hover:text-gray-600"
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="text-sm text-gray-500 bg-transparent border-none focus:outline-none cursor-pointer"
            >
              <option value="recent">Most recent</option>
              <option value="upvoted">Most upvoted</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mb-8 pb-6 border-b border-gray-100">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 block">Faculty</label>
                <select
                  value={filters.faculty}
                  onChange={(e) => setFilters({ faculty: e.target.value, department: "", course: "" })}
                  className="w-full text-sm bg-gray-50 border-0 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-200"
                >
                  <option value="">All faculties</option>
                  {mockFaculties.map((f) => (
                    <option key={f.id} value={f.name}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 block">Department</label>
                <select
                  value={filters.department}
                  onChange={(e) => setFilters((prev) => ({ ...prev, department: e.target.value, course: "" }))}
                  disabled={!filters.faculty}
                  className="w-full text-sm bg-gray-50 border-0 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50"
                >
                  <option value="">All departments</option>
                  {availableDepartments.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 block">Course</label>
                <select
                  value={filters.course}
                  onChange={(e) => setFilters((prev) => ({ ...prev, course: e.target.value }))}
                  disabled={!filters.department}
                  className="w-full text-sm bg-gray-50 border-0 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50"
                >
                  <option value="">All courses</option>
                  {availableCourses.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Results count */}
        <div className="mb-6">
          <span className="text-sm text-gray-400">{filteredNotes.length} notes</span>
        </div>

        {/* Notes - Card or List view */}
        {filteredNotes.length > 0 ? (
          viewMode === "card" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredNotes.map((note) => (
                <NoteCardItem
                  key={note.id}
                  note={note}
                  onVote={onVote}
                  onClick={() => onNoteClick(note)}
                />
              ))}
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              {filteredNotes.map((note) => (
                <NoteListItem
                  key={note.id}
                  note={note}
                  onVote={onVote}
                  onClick={() => onNoteClick(note)}
                />
              ))}
            </div>
          )
        ) : (
          <div className="py-16 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-6 h-6 text-gray-300" />
            </div>
            <p className="text-gray-400 mb-3">No notes found</p>
            <button onClick={clearFilters} className="text-sm text-orange-600 hover:underline">
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function NoteDetailPage({
  note,
  onVote,
  onBack,
  onUserClick,
}: {
  note: Note;
  onVote: (id: string, type: "up" | "down") => void;
  onBack: () => void;
  onUserClick: (username: string) => void;
}) {
  const handleDownload = () => {
    alert(`Downloading ${note.fileName}... (Demo)`);
  };

  return (
    <div className="min-h-screen bg-[#f7f7f5] pt-14">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-8 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs text-gray-400 uppercase tracking-wide">{note.fileType}</span>
            <span className="text-gray-300">·</span>
            <span className="text-xs text-gray-400">{format(note.uploadDate, "MMMM d, yyyy")}</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">{note.courseName}</h1>
          <p className="text-gray-500">{note.professorName}</p>
        </div>

        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
          <button
            onClick={() => onVote(note.id, "up")}
            className="flex items-center gap-2 text-gray-400 hover:text-orange-600 transition-colors"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
          <span className={cn(
            "text-lg font-medium",
            note.netScore > 0 ? "text-orange-600" : "text-gray-400"
          )}>
            {note.netScore}
          </span>
          <button
            onClick={() => onVote(note.id, "down")}
            className="flex items-center gap-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowDown className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-8">
          <div className="h-36 bg-gray-100 rounded-xl flex items-center justify-center">
            <FileTypeIcon type={note.fileType} className="w-12 h-12 text-gray-300" />
          </div>
        </div>

        {note.description && (
          <div className="mb-8">
            <h2 className="text-sm font-medium text-gray-900 mb-2">Description</h2>
            <p className="text-gray-500 text-sm leading-relaxed">{note.description}</p>
          </div>
        )}

        <div className="mb-8 space-y-2.5">
          <div className="flex items-center gap-3">
            <Building2 className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">{note.faculty}</span>
          </div>
          <div className="flex items-center gap-3">
            <GraduationCap className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">{note.department}</span>
          </div>
        </div>

        <div className="mb-8 pb-6 border-b border-gray-100">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Uploaded by</p>
          <button
            onClick={() => onUserClick(note.uploader.username)}
            className="flex items-center gap-3 group"
          >
            <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
              {note.uploader.username.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-sm text-gray-900 group-hover:text-orange-600 transition-colors">
              @{note.uploader.username}
            </span>
          </button>
        </div>

        <button
          onClick={handleDownload}
          className="flex items-center gap-2 text-sm text-orange-600 hover:underline"
        >
          <Download className="w-4 h-4" />
          Download {note.fileType}
        </button>
      </div>
    </div>
  );
}

function UploadPage({ onUpload, onCancel }: { onUpload: (note: Partial<Note>) => void; onCancel: () => void }) {
  const [formData, setFormData] = useState({
    faculty: "",
    department: "",
    courseName: "",
    professorName: "",
    description: "",
    fileName: "",
  });

  const availableDepartments = formData.faculty
    ? mockFaculties.find((f) => f.name === formData.faculty)?.departments || []
    : [];

  const availableCourses = formData.department
    ? availableDepartments.find((d) => d.name === formData.department)?.courses || []
    : [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({ ...prev, fileName: file.name }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.courseName || !formData.professorName || !formData.fileName) {
      alert("Please fill in all required fields");
      return;
    }

    const fileType = formData.fileName.endsWith(".pdf")
      ? "PDF"
      : formData.fileName.match(/\.(jpg|jpeg|png|gif)$/i)
      ? "Image"
      : "Document";

    onUpload({
      ...formData,
      fileType: fileType as "PDF" | "Image" | "Document",
      uploader: { username: "current_user", id: "current" },
      uploadDate: new Date(),
      upvotes: 0,
      downvotes: 0,
      netScore: 0,
    });
  };

  return (
    <div className="min-h-screen bg-[#f7f7f5] pt-14">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <button
          onClick={onCancel}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-8 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <div className="mb-10">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Upload notes</h1>
          <p className="text-gray-500 text-sm">Share with the Waseda community</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wide mb-2 block">Faculty</label>
              <select
                value={formData.faculty}
                onChange={(e) => setFormData((prev) => ({ ...prev, faculty: e.target.value, department: "", courseName: "" }))}
                className="w-full text-sm bg-gray-50 border-0 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-200"
              >
                <option value="">Select</option>
                {mockFaculties.map((f) => (
                  <option key={f.id} value={f.name}>{f.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wide mb-2 block">Department</label>
              <select
                value={formData.department}
                onChange={(e) => setFormData((prev) => ({ ...prev, department: e.target.value, courseName: "" }))}
                disabled={!formData.faculty}
                className="w-full text-sm bg-gray-50 border-0 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50"
              >
                <option value="">Select</option>
                {availableDepartments.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide mb-2 block">Course</label>
            {availableCourses.length > 0 ? (
              <select
                value={formData.courseName}
                onChange={(e) => setFormData((prev) => ({ ...prev, courseName: e.target.value }))}
                disabled={!formData.department}
                className="w-full text-sm bg-gray-50 border-0 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50"
              >
                <option value="">Select</option>
                {availableCourses.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={formData.courseName}
                onChange={(e) => setFormData((prev) => ({ ...prev, courseName: e.target.value }))}
                placeholder="Course name"
                className="w-full text-sm bg-gray-50 border-0 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            )}
          </div>

          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide mb-2 block">Professor</label>
            <input
              type="text"
              value={formData.professorName}
              onChange={(e) => setFormData((prev) => ({ ...prev, professorName: e.target.value }))}
              placeholder="Professor name"
              className="w-full text-sm bg-gray-50 border-0 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide mb-2 block">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Optional"
              rows={3}
              className="w-full text-sm bg-gray-50 border-0 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide mb-2 block">File</label>
            <div className="relative">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors border border-dashed border-gray-200"
              >
                <Upload className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">
                  {formData.fileName || "Choose file"}
                </span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Upload
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProfilePage({
  user,
  notes,
  onVote,
  onNoteClick,
  onBack,
}: {
  user: User;
  notes: Note[];
  onVote: (id: string, type: "up" | "down") => void;
  onNoteClick: (note: Note) => void;
  onBack: () => void;
}) {
  const groupedNotes = notes.reduce((acc, note) => {
    if (!acc[note.faculty]) acc[note.faculty] = [];
    acc[note.faculty].push(note);
    return acc;
  }, {} as { [key: string]: Note[] });

  return (
    <div className="min-h-screen bg-[#f7f7f5] pt-14">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-10 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <div className="mb-10">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-xl font-medium text-gray-600 mb-4">
            {user.username.slice(0, 2).toUpperCase()}
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">@{user.username}</h1>
          <p className="text-gray-500 text-sm">Waseda University</p>
        </div>

        <div className="flex gap-8 mb-10">
          <div>
            <p className="text-2xl font-semibold text-gray-900">{user.totalNotes}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wide mt-1">Notes</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-orange-600">{user.totalUpvotes}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wide mt-1">Upvotes</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-gray-900">{user.coursesContributed}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wide mt-1">Courses</p>
          </div>
        </div>

        <div className="space-y-10">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Contributions</h2>
          
          {Object.entries(groupedNotes).map(([faculty, facultyNotes]) => (
            <div key={faculty}>
              <h3 className="text-sm text-gray-900 font-medium mb-4">{faculty}</h3>
              <div>
                {facultyNotes.map((note) => (
                  <NoteListItem key={note.id} note={note} onVote={onVote} onClick={() => onNoteClick(note)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [notes, setNotes] = useState<Note[]>(mockNotes);
  const [currentView, setCurrentView] = useState<string>("browse");
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const handleVote = (id: string, type: "up" | "down") => {
    setNotes((prev) =>
      prev.map((note) => {
        if (note.id !== id) return note;
        const newUpvotes = type === "up" ? note.upvotes + 1 : note.upvotes;
        const newDownvotes = type === "down" ? note.downvotes + 1 : note.downvotes;
        return {
          ...note,
          upvotes: newUpvotes,
          downvotes: newDownvotes,
          netScore: newUpvotes - newDownvotes,
        };
      })
    );
  };

  const handleNoteClick = (note: Note) => {
    setSelectedNote(note);
    setCurrentView("detail");
    window.scrollTo(0, 0);
  };

  const handleUserClick = (username: string) => {
    const user = getUserByUsername(username);
    if (user) {
      setSelectedUser(user);
      setCurrentView("profile");
      window.scrollTo(0, 0);
    }
  };

  const handleUpload = (noteData: Partial<Note>) => {
    const newNote: Note = {
      ...noteData,
      id: `n${Date.now()}`,
    } as Note;
    setNotes((prev) => [newNote, ...prev]);
    setCurrentView("browse");
    alert("Note uploaded! (Demo)");
  };

  const navigate = (view: string) => {
    setCurrentView(view);
    if (view === "browse") {
      setSelectedNote(null);
      setSelectedUser(null);
    }
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen bg-[#f7f7f5] font-sans">
      <Navigation currentView={currentView} onNavigate={navigate} />

      {currentView === "browse" && (
        <BrowsePage
          notes={notes}
          onVote={handleVote}
          onNoteClick={handleNoteClick}
        />
      )}

      {currentView === "detail" && selectedNote && (
        <NoteDetailPage
          note={selectedNote}
          onVote={handleVote}
          onBack={() => navigate("browse")}
          onUserClick={handleUserClick}
        />
      )}

      {currentView === "upload" && (
        <UploadPage onUpload={handleUpload} onCancel={() => navigate("browse")} />
      )}

      {currentView === "profile" && selectedUser && (
        <ProfilePage
          user={selectedUser}
          notes={getNotesByUploader(selectedUser.username)}
          onVote={handleVote}
          onNoteClick={handleNoteClick}
          onBack={() => navigate("browse")}
        />
      )}

      {currentView === "profile" && !selectedUser && (
        <ProfilePage
          user={mockUsers[0]}
          notes={getNotesByUploader(mockUsers[0].username)}
          onVote={handleVote}
          onNoteClick={handleNoteClick}
          onBack={() => navigate("browse")}
        />
      )}
    </div>
  );
}

export default App;
