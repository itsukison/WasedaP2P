/**
 * API Service Layer
 *
 * Hey backend team
 * Right now, all these functions are hitting mock data.
 * When you're ready with the FastAPI backend, each function below needs to make
 * a real fetch call to your endpoints.
 * 
 * - All endpoints should live under /api/... for now
 *
 */

import type { Note, User } from "@/types";

const _BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

interface AuthResponse {
  user: User;
  token: string;
}

interface CurrentUserResponse {
  userid: number;
  username: string;
  email?: string | null;
  full_name?: string | null;
  disabled?: boolean | null;
}

interface MessageResponse {
  message: string;
}

async function parseApiError(response: Response): Promise<string> {
  try {
    const data = await response.json() as { detail?: string };
    if (typeof data.detail === "string" && data.detail.length > 0) {
      return data.detail;
    }
  } catch {
    // Ignore parse errors and fall back to the status text below.
  }

  return response.statusText || "Request failed";
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${_BASE_URL}${path}`, {
    credentials: "include",
    ...init,
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response;
}

function mapCurrentUserToFrontendUser(user: CurrentUserResponse): User {
  return {
    id: String(user.userid),
    username: user.username,
    email: user.email ?? undefined,
    totalNotes: 0,
    totalUpvotes: 0,
    coursesContributed: 0,
    timetables: [],
  };
}

// ============================================================================
// NOTES
// ============================================================================

/**
 * Get all notes from the platform
 * Used on: BrowsePage, ForumPage
 * Backend: GET /api/notes
 * Returns: Array of all notes with basic info (no file content, just metadata)
 */
export async function getNotes(): Promise<Note[]> {
  const response = await apiFetch("/api/notes");
  const data = await response.json() as any[];
  return data.map((n: any) => ({
    ...n,
    uploadDate: new Date(n.uploadDate),
  }));
}

/**
 * Get a single note by its ID
 * Used on: NoteDetailPage
 * Backend: GET /api/notes/{id}
 * Returns: Single note object or null if not found
 */
export async function getNoteByIdApi(id: string): Promise<Note | null> {
  try {
    const response = await apiFetch(`/api/notes/${id}`);
    const data = await response.json() as any;
    return { ...data, uploadDate: new Date(data.uploadDate) };
  } catch {
    return null;
  }
}
/**
 * Get all notes uploaded by a specific user
 * Used on: ProfilePage (to show user's contributions)
 * Backend: GET /api/notes?uploader={username} or GET /api/users/{username}/notes
 * Returns: Array of notes uploaded by that user
 */
export async function getNotesByUploaderApi(username: string): Promise<Note[]> {
  const response = await apiFetch(`/api/notes?uploader=${username}`);
  const data = await response.json() as any[];
  return data.map((n: any) => ({
    ...n,
    uploadDate: new Date(n.uploadDate),
  }));
}

export async function getUserStatsApi(username: string): Promise<{
  totalNotes: number;
  totalUpvotes: number;
  coursesContributed: number;
}> {
  const response = await apiFetch(`/api/notes/user/${username}/stats`);
  return response.json();
}

/**
 * Upload a new note to the platform
 * Used on: UploadPage
 * Backend: POST /api/notes
 * Payload: {
 *   courseName: string,
 *   professorName: string,
 *   faculty: string,
 *   department: string,
 *   year: number,
 *   semester: "Spring" | "Fall",
 *   fileType: "PDF" | "Image" | "Document",
 *   fileName: string,
 *   description?: string
 * }
 * Returns: The newly created note with generated id, scores, and uploadDate
 */
export async function uploadNote(data: Omit<Note, "id" | "upvotes" | "downvotes" | "netScore" | "uploadDate"> & { file: File }): Promise<Note> {
  const formData = new FormData();
  formData.append("courseName", data.courseName);
  formData.append("professorName", data.professorName);
  formData.append("faculty", data.faculty);
  formData.append("department", data.department);
  formData.append("year", String(data.year));
  formData.append("semester", data.semester);
  formData.append("fileType", data.fileType);
  formData.append("description", data.description ?? "");
  formData.append("file", data.file);

  const response = await apiFetch("/api/notes", {
    method: "POST",
    body: formData,
  });
  const result = await response.json() as any;
  return { ...result, uploadDate: new Date(result.uploadDate) };
}
/**
 * Vote on a note (upvote or downvote)
 * Used on: NoteCard, NoteListItem, NoteDetailPage
 * Backend: POST /api/notes/{id}/vote
 * Payload: { type: "up" | "down" }
 * Returns: void (just update the count on frontend)
 */
export async function voteNote(id: string, type: "up" | "down"): Promise<{upvotes: number, downvotes: number, netScore: number}> {
  const response = await apiFetch(`/api/notes/${id}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type }),
  });
  return response.json();
}
/**
 * Report a note for inappropriate content
 * Used on: ReportButton component
 * Backend: POST /api/notes/{id}/report
 * Payload: { reason: string }
 * Returns: void (backend will handle review process)
 *
 * Note: We don't really do anything with the response yet,
 * but you guys should probably store this for admin review
 */
export async function reportNote(id: string, reason: string): Promise<void> {
  await apiFetch(`/api/notes/${id}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}


// USERS


/**
 * Get all users (probably won't need this often, but hey)
 * Backend: GET /api/users
 * Returns: Array of all user profiles
 */

export async function getUsers(): Promise<User[]> {
  const response = await apiFetch("/api/users");
  return response.json();
}

/**
 * Get a single user by username
 * Used on: ProfilePage, anywhere we display user info
 * Backend: GET /api/users/{username}
 * Returns: User object or null if not found
 */

export async function getUserApi(username: string): Promise<User | null> {
  try {
    const response = await apiFetch(`/api/users/${username}`);
    return response.json();
  } catch {
    return null;
  }
}

// AUTH

/**
 * Login with email and password
 * Used on: LoginPage
 * Backend: POST /api/auth/login
 * Payload: { email: string, password: string }
 * Returns: User object, and stores the JWT token for later requests
 */
export async function loginApi(
  email: string,
  password: string
): Promise<User> {
  const response = await apiFetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json() as AuthResponse;
  localStorage.setItem("authToken", data.token);
  return data.user;
}

/**
 * Register a new user
 * Used on: SignupPage
 * Backend: POST /api/auth/signup
 * Payload: { username: string, email: string, password: string }
 * Returns: void
 */
export async function signupApi(data: {
  username: string;
  email: string;
  password: string;
}): Promise<void> {
  const response = await apiFetch("/api/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  const responseData = await response.json() as Partial<AuthResponse>;
  if (typeof responseData.token === "string") {
    localStorage.setItem("authToken", responseData.token);
  }
}

export async function getCurrentUserApi(): Promise<User> {
  const response = await apiFetch("/users/me/");
  const data = await response.json() as CurrentUserResponse;
  return mapCurrentUserToFrontendUser(data);
}

export async function logoutApi(): Promise<void> {
  await apiFetch("/logout", {
    method: "POST",
  });
  localStorage.removeItem("authToken");
}

export async function resetPasswordApi(email: string): Promise<string> {
  const response = await apiFetch("/api/auth/reset-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });
  const data = await response.json() as MessageResponse;
  return data.message;
}

export async function verifyEmailApi(token: string): Promise<string> {
  const response = await apiFetch("/api/auth/verify-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });
  const data = await response.json() as MessageResponse;
  return data.message;
}


// FUTURE STUFF (Not implemented yet)
/*
 * Things we might need later:
 * - Timetable management: GET/POST /api/users/{username}/timetable
 * - File download: GET /api/notes/{id}/download
 * - Search: GET /api/notes/search?q=...
 */
