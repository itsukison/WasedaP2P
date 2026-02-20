export interface User {
  id: string;
  username: string;
  totalNotes: number;
  totalUpvotes: number;
  coursesContributed: number;
}

export interface Note {
  id: string;
  courseName: string;
  professorName: string;
  faculty: string;
  department: string;
  uploader: {
    username: string;
    id: string;
  };
  uploadDate: Date;
  fileType: "PDF" | "Image" | "Document";
  fileName: string;
  upvotes: number;
  downvotes: number;
  netScore: number;
  description?: string;
}

export interface Faculty {
  id: string;
  name: string;
  departments: Department[];
}

export interface Department {
  id: string;
  name: string;
  courses: Course[];
}

export interface Course {
  id: string;
  name: string;
  professor: string;
}

export type SortOption = "recent" | "upvoted" | "name";

export interface FilterState {
  faculty: string;
  department: string;
  course: string;
}
