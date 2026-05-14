import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, ArrowUp, ArrowDown, Download, Building2, GraduationCap, FileText, Image, File } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import type { Note } from "@/types";
import { getNoteByIdApi, voteNote } from "@/services/api";
import { ReportButton } from "@/components/notes/ReportButton";
import { cn } from "@/lib/utils";

function FileTypeIcon({ type, className }: { type: string; className?: string }) {
  if (type === "PDF") return <FileText className={cn("text-zinc-300", className)} />;
  if (type === "Image") return <Image className={cn("text-zinc-300", className)} />;
  return <File className={cn("text-zinc-300", className)} />;
}

export function NoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [note, setNote] = useState<Note | null>(null);

  useEffect(() => {
    if (id) {
      getNoteByIdApi(id).then((n) => {
        if (!n) navigate("/browse");
        else setNote(n);
      });
    }
  }, [id, navigate]);

  if (!note) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="h-6 w-32 bg-zinc-100 rounded animate-pulse" />
      </div>
    );
  }

  const handleVote = async (type: "up" | "down") => {
    const result = await voteNote(note.id, type);
    setNote((prev) => {
      if (!prev) return prev;
      return { 
        ...prev, 
        upvotes: result.upvotes, 
        downvotes: result.downvotes, 
        netScore: result.netScore 
      };
    });
};

  const handleDownload = () => {
    toast.info(`Downloading ${note.fileName}…`);
    const link = document.createElement("a");
    link.href = `http://localhost:8000/api/notes/${note.id}/download`;
    link.download = note.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 mb-10 transition-colors duration-150 cursor-pointer"
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>

      {/* Title block */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs text-zinc-400 uppercase tracking-wide">{note.fileType}</span>
          <span className="text-zinc-200">·</span>
          <span className="text-xs text-zinc-400">{format(note.uploadDate, "MMMM d, yyyy")}</span>
          <span className="text-zinc-200">·</span>
          <span className="text-xs text-zinc-400">{note.semester} {note.year}</span>
        </div>
        <h1 className="text-2xl font-medium text-zinc-900 mb-2">{note.courseName}</h1>
        <p className="text-zinc-500">{note.professorName}</p>
      </div>

      {/* Votes */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => handleVote("up")}
          className="flex items-center gap-1 text-zinc-400 hover:text-orange-600 transition-colors duration-150 cursor-pointer"
          aria-label="Upvote"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
        <span className={cn("text-lg font-medium", note.netScore > 0 ? "text-orange-600" : "text-zinc-400")}>
          {note.netScore}
        </span>
        <button
          onClick={() => handleVote("down")}
          className="flex items-center gap-1 text-zinc-400 hover:text-zinc-600 transition-colors duration-150 cursor-pointer"
          aria-label="Downvote"
        >
          <ArrowDown className="w-5 h-5" />
        </button>
      </div>

      {/* File preview placeholder */}
      <div className="mb-8">
        <div className="h-40 bg-zinc-50 rounded-xl flex items-center justify-center">
          <FileTypeIcon type={note.fileType} className="w-12 h-12" />
        </div>
      </div>

      {/* Description */}
      {note.description && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-zinc-900 mb-2">Description</h2>
          <p className="text-zinc-500 text-sm leading-relaxed">{note.description}</p>
        </div>
      )}

      {/* Metadata */}
      <div className="mb-8 space-y-2.5">
        <div className="flex items-center gap-3">
          <Building2 className="w-4 h-4 text-zinc-400" />
          <span className="text-sm text-zinc-500">{note.faculty}</span>
        </div>
        <div className="flex items-center gap-3">
          <GraduationCap className="w-4 h-4 text-zinc-400" />
          <span className="text-sm text-zinc-500">{note.department}</span>
        </div>
      </div>

      {/* Uploader */}
      <div className="mb-8">
        <p className="text-xs text-zinc-400 uppercase tracking-wide mb-3">Uploaded by</p>
        <button
          onClick={() => navigate(`/profile/${note.uploader.username}`)}
          className="flex items-center gap-3 group cursor-pointer"
        >
          <div className="w-9 h-9 bg-zinc-100 rounded-full flex items-center justify-center text-sm font-medium text-zinc-600">
            {note.uploader.username.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-sm text-zinc-900 group-hover:text-orange-600 transition-colors duration-150">
            @{note.uploader.username}
          </span>
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-6">
        <button
          onClick={handleDownload}
          className="flex items-center gap-1 text-sm text-orange-600 hover:underline cursor-pointer"
        >
          <Download className="w-4 h-4" />
          Download {note.fileType}
        </button>
        <ReportButton noteId={note.id} />
      </div>
    </div>
  );
}
