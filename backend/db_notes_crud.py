import os
import shutil
from sqlalchemy.orm import Session
from models_notes import Note, NoteReport
from db_vote_crud import get_vote, create_vote, update_vote, delete_vote

UPLOAD_DIR = "uploaded_notes"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def save_file_to_disk(file_bytes: bytes, filename: str) -> str:
    file_path = os.path.join(UPLOAD_DIR, filename)
    with open(file_path, "wb") as f:
        f.write(file_bytes)
    return file_path


def format_note(note: Note) -> dict:
    return {
        "id": str(note.id),
        "courseName": note.course_name,
        "professorName": note.professor_name,
        "faculty": note.faculty,
        "department": note.department,
        "year": note.year,
        "semester": note.semester,
        "uploader": {
            "username": note.uploader.username,
            "id": str(note.uploader_id),
        },
        "uploadDate": note.upload_date.isoformat() + "Z",
        "fileType": note.file_type,
        "fileName": note.file_name,
        "upvotes": note.upvotes,
        "downvotes": note.downvotes,
        "netScore": note.upvotes - note.downvotes,
        "description": note.description or "",
    }


def get_all_notes(
    db: Session,
    faculty: str = None,
    department: str = None,
    course: str = None,
    uploader: str = None,
    semester: str = None,
    year: int = None,
    sort: str = None,
) -> list:
    query = db.query(Note)

    if faculty:
        query = query.filter(Note.faculty == faculty)
    if department:
        query = query.filter(Note.department == department)
    if course:
        query = query.filter(Note.course_name == course)
    if semester:
        query = query.filter(Note.semester == semester)
    if year:
        query = query.filter(Note.year == year)
    if uploader:
        query = query.join(Note.uploader).filter(
            Note.uploader.has(username=uploader)
        )

    if sort == "recent" or sort is None:
        query = query.order_by(Note.upload_date.desc())
    elif sort == "upvoted":
        query = query.order_by((Note.upvotes - Note.downvotes).desc())
    elif sort == "name":
        query = query.order_by(Note.course_name.asc())

    notes = query.all()
    return [format_note(n) for n in notes]


def get_note_by_id(db: Session, note_id: int) -> dict | None:
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        return None
    return format_note(note)


def create_note(
    db: Session,
    course_name: str,
    professor_name: str,
    faculty: str,
    department: str,
    year: int,
    semester: str,
    file_type: str,
    description: str,
    file_bytes: bytes,
    file_name: str,
    uploader_id: int,
) -> dict:
    file_path = save_file_to_disk(file_bytes, file_name)

    note = Note(
        course_name=course_name,
        professor_name=professor_name,
        faculty=faculty,
        department=department,
        year=year,
        semester=semester,
        file_type=file_type,
        file_name=file_name,
        file_data=file_path,
        description=description,
        uploader_id=uploader_id,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return format_note(note)


def vote_on_note(db: Session, note_id: int, vote_type: str, user_id: int) -> dict | None:
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        return None

    vote_value = 1 if vote_type == "up" else -1
    existing_vote = get_vote(db, user_id, "note", note_id)

    if existing_vote:
        if existing_vote.vote_value == vote_value:
            # Same vote again → remove it (toggle off)
            if vote_type == "up":
                note.upvotes = max(0, note.upvotes - 1)
            else:
                note.downvotes = max(0, note.downvotes - 1)
            delete_vote(db, existing_vote)
        else:
            # Different vote → switch it
            if vote_type == "up":
                note.upvotes += 1
                note.downvotes = max(0, note.downvotes - 1)
            else:
                note.downvotes += 1
                note.upvotes = max(0, note.upvotes - 1)
            update_vote(db, existing_vote, vote_value)
    else:
        # First time voting
        if vote_type == "up":
            note.upvotes += 1
        else:
            note.downvotes += 1
        create_vote(db, user_id, "note", note_id, vote_value)

    db.commit()
    db.refresh(note)
    return {
        "upvotes": note.upvotes,
        "downvotes": note.downvotes,
        "netScore": note.upvotes - note.downvotes,
    }

def get_user_stats(db: Session, username: str) -> dict:
    from models import UserModel
    
    user = db.query(UserModel).filter(UserModel.username == username).first()
    if not user:
        return {
            "totalNotes": 0,
            "totalUpvotes": 0,
            "coursesContributed": 0,
        }
    
    notes = db.query(Note).filter(Note.uploader_id == user.id).all()
    
    total_notes = len(notes)
    total_upvotes = sum(n.upvotes for n in notes)
    courses_contributed = len(set(n.course_name for n in notes))
    
    return {
        "totalNotes": total_notes,
        "totalUpvotes": total_upvotes,
        "coursesContributed": courses_contributed,
    }

def report_note(
    db: Session, note_id: int, reporter_id: int, reason: str
) -> bool:
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        return False

    report = NoteReport(
        note_id=note_id,
        reporter_id=reporter_id,
        reason=reason,
    )
    db.add(report)
    db.commit()
    return True


def get_note_file_path(db: Session, note_id: int) -> tuple[str, str] | None:
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        return None
    return note.file_data, note.file_name