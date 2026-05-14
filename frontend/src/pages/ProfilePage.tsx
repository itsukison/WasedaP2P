import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { User, Note } from "@/types";
import { getUserApi, getNotesByUploaderApi, getUserStatsApi } from "@/services/api";
import { NoteListItem } from "@/components/notes/NoteListItem";
import { TimetableSection } from "@/components/profile/TimetableSection";
import { voteNote } from "@/services/api";

export function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    if (!username) return;
    getUserApi(username).then((u) => {
      if (!u) navigate("/browse");
      else {
        getUserStatsApi(username).then((stats) => {
          setUser({
            ...u,
            totalNotes: stats.totalNotes,
            totalUpvotes: stats.totalUpvotes,
            coursesContributed: stats.coursesContributed,
          });
        });
      }
    });
    getNotesByUploaderApi(username).then(setNotes);
}, [username, navigate]);

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="h-6 w-40 bg-zinc-100 rounded animate-pulse" />
      </div>
    );
  }

  const handleVote = async (id: string, type: "up" | "down") => {
    const result = await voteNote(id, type);
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        return {
          ...n,
          upvotes: result.upvotes,
          downvotes: result.downvotes,
          netScore: result.netScore,
        };
      })
    );
};

  const groupedNotes = notes.reduce<Record<string, Note[]>>((acc, note) => {
    if (!acc[note.faculty]) acc[note.faculty] = [];
    acc[note.faculty].push(note);
    return acc;
  }, {});

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Avatar + name */}
      <div className="mb-10">
        <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center text-lg font-semibold text-orange-600 mb-4">
          {user.username.slice(0, 2).toUpperCase()}
        </div>
        <h1 className="text-2xl font-medium text-zinc-900 mb-1">@{user.username}</h1>
        <p className="text-zinc-500 text-sm">Waseda University</p>
      </div>

      {/* Stats */}
      <div className="flex gap-8 mb-12">
        <div>
          <p className="text-2xl font-medium text-zinc-900">{user.totalNotes}</p>
          <p className="text-xs text-zinc-400 uppercase tracking-wide mt-1">Notes</p>
        </div>
        <div>
          <p className="text-2xl font-medium text-orange-600">{user.totalUpvotes}</p>
          <p className="text-xs text-zinc-400 uppercase tracking-wide mt-1">Upvotes</p>
        </div>
        <div>
          <p className="text-2xl font-medium text-zinc-900">{user.coursesContributed}</p>
          <p className="text-xs text-zinc-400 uppercase tracking-wide mt-1">Courses</p>
        </div>
      </div>

      {/* Contributions */}
      {Object.entries(groupedNotes).length > 0 && (
        <div className="mb-16">
          <h2 className="text-lg font-medium text-zinc-900 mb-6">Contributions</h2>
          <div className="space-y-10">
            {Object.entries(groupedNotes).map(([faculty, facultyNotes]) => (
              <div key={faculty}>
                <h3 className="text-sm font-medium text-zinc-500 mb-3">{faculty}</h3>
                {facultyNotes.map((note) => (
                  <NoteListItem
                    key={note.id}
                    note={note}
                    onVote={handleVote}
                    onClick={() => navigate(`/notes/${note.id}`)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timetable */}
      <TimetableSection timetables={user.timetables ?? []} />
    </div>
  );
}
