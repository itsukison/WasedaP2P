from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from db_init import get_db
from db_notes_crud import (
    get_all_notes,
    get_note_by_id,
    create_note,
    vote_on_note,
    report_note,
    get_note_file_path,
    get_user_stats,
)
from pydantic import BaseModel
import jwt
import os

router = APIRouter(prefix="/api/notes", tags=["notes"])

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
COOKIE_NAME = "access_token"


class VoteRequest(BaseModel):
    type: str


class ReportRequest(BaseModel):
    reason: str


def get_current_user_id(request: Request, db: Session = Depends(get_db)) -> int:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return int(user_id)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.get("")
def list_notes(
    faculty: str = None,
    department: str = None,
    course: str = None,
    uploader: str = None,
    semester: str = None,
    year: int = None,
    sort: str = None,
    db: Session = Depends(get_db),
):
    return get_all_notes(
        db,
        faculty=faculty,
        department=department,
        course=course,
        uploader=uploader,
        semester=semester,
        year=year,
        sort=sort,
    )

@router.get("/user/{username}/stats")
def get_user_note_stats(username: str, db: Session = Depends(get_db)):
    return get_user_stats(db, username)

@router.get("/{note_id}")
def get_note(note_id: int, db: Session = Depends(get_db)):
    note = get_note_by_id(db, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@router.post("", status_code=201)
async def upload_note(
    courseName: str = Form(...),
    professorName: str = Form(...),
    faculty: str = Form(...),
    department: str = Form(...),
    year: int = Form(...),
    semester: str = Form(...),
    fileType: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    file_bytes = await file.read()
    result = create_note(
        db=db,
        course_name=courseName,
        professor_name=professorName,
        faculty=faculty,
        department=department,
        year=year,
        semester=semester,
        file_type=fileType,
        description=description,
        file_bytes=file_bytes,
        file_name=file.filename,
        uploader_id=current_user_id,
    )
    return result


@router.post("/{note_id}/vote")
def vote(
    note_id: int,
    body: VoteRequest,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    if body.type not in ["up", "down"]:
        raise HTTPException(status_code=400, detail="type must be 'up' or 'down'")
    result = vote_on_note(db, note_id, body.type, current_user_id)
    if not result:
        raise HTTPException(status_code=404, detail="Note not found")
    return result


@router.post("/{note_id}/report")
def report(
    note_id: int,
    body: ReportRequest,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    success = report_note(db, note_id, current_user_id, body.reason)
    if not success:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": "Report submitted successfully"}


@router.get("/{note_id}/download")
def download_note(
    note_id: int,
    db: Session = Depends(get_db),
):
    result = get_note_file_path(db, note_id)
    if not result:
        raise HTTPException(status_code=404, detail="Note not found")

    file_path, file_name = result
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on server")

    return FileResponse(
        path=file_path,
        filename=file_name,
        media_type="application/octet-stream",
    )