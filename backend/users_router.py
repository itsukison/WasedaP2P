from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import List, Optional
from db_init import get_db
from models import UserModel
from models_notes import Note
from models_users import Timetable, TimetableEntry, Faculty, Department, Course
router = APIRouter(prefix="/api", tags=["users"])


# ── Pydantic response schemas ────────────────────────────────────

class TimetableEntryOut(BaseModel):
    courseId: Optional[str] = None
    courseName: str
    professor: Optional[str] = None
    room: Optional[str] = None
    day: str
    period: int

    model_config = {"from_attributes": True}


class TimetableOut(BaseModel):
    semester: str
    year: int
    entries: List[TimetableEntryOut] = []

    model_config = {"from_attributes": True}


class UserProfileOut(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    totalNotes: int = 0
    totalUpvotes: int = 0
    coursesContributed: int = 0
    timetables: List[TimetableOut] = []

    model_config = {"from_attributes": True}


class NoteOut(BaseModel):
    id: int
    courseName: str
    professorName: str
    faculty: str
    department: str
    year: int
    semester: str
    fileType: str
    description: Optional[str] = None
    upvotes: int
    downvotes: int

    model_config = {"from_attributes": True}


# ── Helper: build UserProfileOut from a UserModel row ────────────

def build_user_profile(user: UserModel) -> dict:
    notes = user.notes  # available via backref in models_notes.py
    total_notes = len(notes)
    total_upvotes = sum(n.upvotes for n in notes)
    courses_contributed = len(set(n.course_name for n in notes))

    timetables = []
    for t in user.timetables:
        entries = [
            TimetableEntryOut(
                courseId=e.course_id,
                courseName=e.course_name,
                professor=e.professor,
                room=e.room,
                day=e.day,
                period=e.period,
            )
            for e in t.entries
        ]
        timetables.append(TimetableOut(
            semester=t.semester,
            year=t.year,
            entries=entries,
        ))

    return {
        "id": str(user.id),
        "username": user.username,
        "email": user.email,
        "totalNotes": total_notes,
        "totalUpvotes": total_upvotes,
        "coursesContributed": courses_contributed,
        "timetables": timetables,
    }


# ── GET /api/users ───────────────────────────────────────────────

@router.get("/users")
def get_all_users(db: Session = Depends(get_db)):
    users = (
        db.query(UserModel)
        .options(
            joinedload(UserModel.notes),
            joinedload(UserModel.timetables).joinedload(Timetable.entries),
        )
        .all()
    )
    return [build_user_profile(u) for u in users]


# ── GET /api/users/{username} ────────────────────────────────────

@router.get("/users/{username}")
def get_user_profile(username: str, db: Session = Depends(get_db)):
    user = (
        db.query(UserModel)
        .options(
            joinedload(UserModel.notes),
            joinedload(UserModel.timetables).joinedload(Timetable.entries),
        )
        .filter(UserModel.username == username)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return build_user_profile(user)


# ── GET /api/users/{username}/notes ─────────────────────────────

@router.get("/users/{username}/notes")
def get_user_notes(username: str, db: Session = Depends(get_db)):
    user = (
        db.query(UserModel)
        .filter(UserModel.username == username)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    notes = (
        db.query(Note)
        .filter(Note.uploader_id == user.id)
        .all()
    )
    return [
        {
            "id": n.id,
            "courseName": n.course_name,
            "professorName": n.professor_name,
            "faculty": n.faculty,
            "department": n.department,
            "year": n.year,
            "semester": n.semester,
            "fileType": n.file_type,
            "description": n.description,
            "upvotes": n.upvotes,
            "downvotes": n.downvotes,
        }
        for n in notes
    ]

# ── GET /api/faculties ───────────────────────────────────────────

@router.get("/faculties")
def get_faculties(db: Session = Depends(get_db)):
    faculties = (
        db.query(Faculty)
        .options(
            joinedload(Faculty.departments).joinedload(Department.courses)
        )
        .all()
    )
    return [
        {
            "id": f.id,
            "name": f.name,
            "departments": [
                {
                    "id": d.id,
                    "name": d.name,
                    "courses": [
                        {
                            "id": c.id,
                            "name": c.name,
                            "professor": c.professor,
                        }
                        for c in d.courses
                    ],
                }
                for d in f.departments
            ],
        }
        for f in faculties
    ]

# ── POST /api/users/{username}/timetable ─────────────────────────

class TimetableEntryIn(BaseModel):
    courseId: Optional[str] = None
    courseName: str
    professor: Optional[str] = None
    room: Optional[str] = None
    day: str
    period: int

class TimetableIn(BaseModel):
    semester: str
    year: int
    entries: List[TimetableEntryIn]

@router.post("/users/{username}/timetable")
def save_timetable(
    username: str,
    data: TimetableIn,
    db: Session = Depends(get_db)
):
    user = db.query(UserModel).filter(UserModel.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Delete existing timetable for same semester/year if it exists
    existing = (
        db.query(Timetable)
        .filter(
            Timetable.user_id == user.id,
            Timetable.semester == data.semester,
            Timetable.year == data.year,
        )
        .first()
    )
    if existing:
        db.delete(existing)
        db.flush()

    # Create new timetable
    timetable = Timetable(
        semester=data.semester,
        year=data.year,
        user_id=user.id,
    )
    db.add(timetable)
    db.flush()

    # Add entries
    for e in data.entries:
        entry = TimetableEntry(
            course_id=e.courseId,
            course_name=e.courseName,
            professor=e.professor,
            room=e.room,
            day=e.day,
            period=e.period,
            timetable_id=timetable.id,
        )
        db.add(entry)

    db.commit()
    return {"message": "Timetable saved successfully"}