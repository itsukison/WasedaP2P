import jwt
import os
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Annotated
from urllib.parse import urlencode
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status, Response, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jwt.exceptions import InvalidTokenError
from pydantic import BaseModel
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager
from db_init import get_db, create_tables, ensure_schema_updates
from models import UserModel
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from db_login_crud import get_user_id, get_user_by_id, get_user_by_email, create_user, get_users, delete_user, get_user_role, mark_user_email_verified
from db_folder_crud import create_folder, validate_folder_creation, delete_folder, get_folder, rename_folder
from db_vote_crud import get_vote, create_vote, update_vote, delete_vote, get_vote_stats, update_votable_counts, validate_votable_exists, get_user_votes
from notes_router import router as notes_router
from users_router import router as users_router

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = 30
COOKIE_NAME = "access_token"
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
SMTP_USE_SSL = os.getenv("SMTP_USE_SSL", "false").lower() == "true"



# Create tables on startup
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Creating database tables...")
    create_tables()  # ✅ Run table creation on startup
    ensure_schema_updates()
    yield  # Allow FastAPI to start
    print("FastAPI is shutting down...")  # Shutdown logic (optional)
# =========================
# Pydantic Schemas
# =========================

class TokenData(BaseModel):
    id: int


class LoginInformation(BaseModel):
    email: str
    password: str


class PasswordResetRequest(BaseModel):
    email: str


class EmailVerificationRequest(BaseModel):
    token: str


class User(BaseModel):
    userid: int
    username: str
    email: str | None = None
    full_name: str | None = None
    disabled: bool| None = None
    email_verified: bool = False


class UserInDB(User):
    hashed_password: str


class AuthResponse(BaseModel):
    user: dict
    token: str

class FolderResponse(BaseModel):
    id : int
    name : str
    path : str
    depth : int
    created_at : datetime
    user_id : int

class VoteCreate(BaseModel):
    votable_type: str
    votable_id: int
    vote_value: int

class VoteResponse(BaseModel):
    id: int
    user_id: int
    votable_type: str
    votable_id: int
    vote_value: int
    created_at: datetime
    updated_at: datetime | None

class VoteStats(BaseModel):
    upvote_count: int
    downvote_count: int
    score: int
    user_vote: int | None = None

# =========================
# Security setup
# =========================

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
# oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

app = FastAPI(lifespan=lifespan)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# =========================
# Utility functions
# =========================

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_user(db: Session, id: int) -> UserInDB | None:
    user = db.query(UserModel).filter(UserModel.id == id).first()
    if not user:
        return None

    return UserInDB(
        userid=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        disabled=user.disabled,
        email_verified=user.email_verified,
        hashed_password=user.hashed_password,
    )


def authenticate_user(db: Session, id: int, password: str):
    user = get_user(db, id)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = (
        datetime.now(timezone.utc) + expires_delta
        if expires_delta
        else datetime.now(timezone.utc) + timedelta(minutes=15)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_email_token(email: str, purpose: str, expires_minutes: int = 60):
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    payload = {
        "sub": email,
        "purpose": purpose,
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_email_token(token: str, expected_purpose: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Invalid token")

    if payload.get("purpose") != expected_purpose:
        raise HTTPException(status_code=400, detail="Invalid token purpose")

    email = payload.get("sub")
    if not isinstance(email, str) or not email:
        raise HTTPException(status_code=400, detail="Invalid token subject")

    return email


def ensure_mail_config():
    required_values = {
        "SMTP_HOST": SMTP_HOST,
        "SMTP_USERNAME": SMTP_USERNAME,
        "SMTP_PASSWORD": SMTP_PASSWORD,
        "SMTP_FROM_EMAIL": SMTP_FROM_EMAIL,
    }
    missing = [key for key, value in required_values.items() if not value]
    if missing:
        raise HTTPException(
            status_code=500,
            detail=f"Missing email configuration: {', '.join(missing)}",
        )


def send_email(to_email: str, subject: str, text_body: str, html_body: str | None = None):
    ensure_mail_config()

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = SMTP_FROM_EMAIL
    message["To"] = to_email
    message.set_content(text_body)
    if html_body:
        message.add_alternative(html_body, subtype="html")

    if SMTP_USE_SSL:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(message)
        return

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        if SMTP_USE_TLS:
            server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(message)


def build_frontend_url(path: str, params: dict[str, str]):
    query = urlencode(params)
    return f"{FRONTEND_URL}{path}?{query}"


def send_verification_email(email: str, username: str):
    token = create_email_token(email, "verify-email", expires_minutes=24 * 60)
    verification_url = build_frontend_url("/verify-email", {"token": token})
    send_email(
        to_email=email,
        subject="Verify your WasedaP2P email",
        text_body=(
            f"Hello {username},\n\n"
            f"Please verify your email by opening this link:\n{verification_url}\n\n"
            "If you did not create this account, you can ignore this email."
        ),
        html_body=(
            f"<p>Hello {username},</p>"
            f"<p>Please verify your email by clicking the link below:</p>"
            f'<p><a href="{verification_url}">Verify your email</a></p>'
            "<p>If you did not create this account, you can ignore this email.</p>"
        ),
    )


def send_password_reset_email(email: str):
    token = create_email_token(email, "reset-password", expires_minutes=60)
    reset_url = build_frontend_url("/reset-password", {"step": "reset", "token": token})
    send_email(
        to_email=email,
        subject="Reset your WasedaP2P password",
        text_body=(
            "We received a request to reset your password.\n\n"
            f"Open this link to continue:\n{reset_url}\n\n"
            "If you did not request this, you can ignore this email."
        ),
        html_body=(
            "<p>We received a request to reset your password.</p>"
            f'<p><a href="{reset_url}">Reset your password</a></p>'
            "<p>If you did not request this, you can ignore this email.</p>"
        ),
    )

# =========================
# Dependencies
# =========================

async def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
):
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user_id_int = int(user_id)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = get_user(db, user_id_int)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
):
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

# =========================
# Routes for login
# =========================

# This creates a cookie token
@app.post("/token")
async def login_for_access_token(
    response: Response,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db),
):
    user_id = get_user_id(db, form_data.username)
    user = authenticate_user(db, user_id, form_data.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # create token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.userid)},
        expires_delta=access_token_expires,
    )

    # save jwt in cookie
    response.set_cookie(
        key=COOKIE_NAME,
        value=access_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )

    return {"message": "ok"}


@app.post("/api/auth/login", response_model=AuthResponse)
async def login_with_email(
    data: LoginInformation,
    response: Response,
    db: Session = Depends(get_db),
):
    user_record = get_user_by_email(db, data.email)
    if user_record is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    user = authenticate_user(db, user_record.id, data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.userid)},
        expires_delta=access_token_expires,
    )

    response.set_cookie(
        key=COOKIE_NAME,
        value=access_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )

    return {
        "user": {
            "id": str(user.userid),
            "username": user.username,
            "email": user.email,
            "totalNotes": 0,
            "totalUpvotes": 0,
            "coursesContributed": 0,
            "timetables": [],
        },
        "token": access_token,
    }


@app.post("/api/auth/reset-password")
async def reset_password(data: PasswordResetRequest):
    send_password_reset_email(data.email)
    return {"message": "Password reset email sent"}


@app.post("/api/auth/verify-email")
async def verify_email(data: EmailVerificationRequest, db: Session = Depends(get_db)):
    if not data.token.strip():
        raise HTTPException(status_code=400, detail="Verification token is required")

    email = decode_email_token(data.token, "verify-email")
    user = mark_user_email_verified(db, email)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    return {"message": "Email verified successfully"}

@app.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"message": "Logged out"}

# Get login user info ✅
@app.get("/users/me/", response_model=User)
async def read_users_me(
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    return current_user

# =========================
# Routes for user database
# =========================

class RegisterInformation(BaseModel):
    username: str
    full_name: str | None = None
    email: str
    password: str

class DeletingInformation(BaseModel):
    username: str
    password: str


@app.post("/register")
@app.post("/api/auth/signup")
async def register(data: RegisterInformation, db: Session = Depends(get_db)):
    existing_user_id = get_user_id(db, data.username)
    if existing_user_id:
        raise HTTPException(status_code=400, detail="User already registered")
    
    user = create_user(
        db,
        data.username,
        data.full_name or data.username,
        data.email,
        data.password,
    )
    send_verification_email(user.email, user.username)
    return {"message": "User registered successfully"}

@app.get("/get_all_user")
async def get_all_user(db: Session = Depends(get_db)):
    response = get_users(db)
    return response

@app.delete("/delete_an_user")
async def delete_an_user(data: DeletingInformation, db: Session = Depends(get_db)):
    response = delete_user(db, data.username, data.password)
    return response

@app.get("/user/role")
async def get_role(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
):
    role = get_user_role(db, current_user.userid)
    if role is None:
        raise HTTPException(status_code=404, detail="User not found")
    return {"id": current_user.userid, "role": role.value}

# =========================
# Routes for folder database
# =========================

@app.post("/folders")
def create_folder_api(
    name: str,
    path: str,
    depth: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # ok, error = validate_folder_creation(
    #     db=db,
    #     name=name,
    #     path=path,
    #     depth=depth,
    #     user_id=current_user.userid,
    # )

    # if not ok:
    #     raise HTTPException(status_code=400, detail=error)


    folder = create_folder(db, name, path, depth, current_user.userid)
    return folder

@app.delete("/folders")
def delete_folder_api(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ok, results = delete_folder(
        db=db,
        folder_id=folder_id,
        user_id=current_user.userid,
    )

    if not ok:
        raise HTTPException(status_code=400, detail=results)
    
    return results

@app.get("/folders", response_model=FolderResponse)
def get_folder_api(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ok, results = get_folder(
        db=db,
        folder_id=folder_id,
        user_id=current_user.userid,
    )

    if not ok:
        raise HTTPException(status_code=400, detail=results)
    
    return results

@app.put("/folders")
def rename_folder_api(
    new_name: str,
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ok, results = rename_folder(
        db=db,
        folder_id=folder_id,
        user_id=current_user.userid,
        new_name=new_name,
    )

    if not ok:
        raise HTTPException(status_code=400, detail=results)
    
    return results

# =========================
# Routes for file
# =========================

@app.post("/files")
def create_folder_api(
    name: str,
    path: str,
    depth: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # ok, error = validate_folder_creation(
    #     db=db,
    #     name=name,
    #     path=path,
    #     depth=depth,
    #     user_id=current_user.userid,
    # )

    # if not ok:
    #     raise HTTPException(status_code=400, detail=error)


    folder = create_folder(db, name, path, depth, current_user.userid)
    return folder

@app.delete("/files")
def delete_folder_api(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ok, results = delete_folder(
        db=db,
        folder_id=folder_id,
        user_id=current_user.userid,
    )

    if not ok:
        raise HTTPException(status_code=400, detail=results)
    
    return results

@app.get("/files", response_model=FolderResponse)
def get_folder_api(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ok, results = get_folder(
        db=db,
        folder_id=folder_id,
        user_id=current_user.userid,
    )

    if not ok:
        raise HTTPException(status_code=400, detail=results)
    
    return results

@app.put("/files")
def rename_folder_api(
    new_name: str,
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ok, results = rename_folder(
        db=db,
        folder_id=folder_id,
        user_id=current_user.userid,
        new_name=new_name,
    )

    if not ok:
        raise HTTPException(status_code=400, detail=results)
    
    return results

# =========================
# Routes for voting
# =========================

@app.post("/votes")
def cast_vote(
    vote_data: VoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Cast a vote (upvote or downvote) on a file or folder"""
    if vote_data.vote_value not in [1, -1]:
        raise HTTPException(
            status_code=400, 
            detail="vote_value must be 1 (upvote) or -1 (downvote)"
        )
    
    if vote_data.votable_type not in ["file", "folder"]:
        raise HTTPException(
            status_code=400, 
            detail="votable_type must be 'file' or 'folder'"
        )
    
    ok, result = validate_votable_exists(
        db, 
        vote_data.votable_type, 
        vote_data.votable_id,
        current_user.userid
    )
    if not ok:
        raise HTTPException(status_code=404, detail=result)
    
    existing_vote = get_vote(
        db, 
        current_user.userid, 
        vote_data.votable_type, 
        vote_data.votable_id
    )
    
    if existing_vote:
        if existing_vote.vote_value == vote_data.vote_value:
            delete_vote(db, existing_vote)
            update_votable_counts(db, vote_data.votable_type, vote_data.votable_id)
            return {"message": "Vote removed"}
        else:
            updated_vote = update_vote(db, existing_vote, vote_data.vote_value)
            update_votable_counts(db, vote_data.votable_type, vote_data.votable_id)
            return {
                "message": "Vote updated",
                "vote": {
                    "id": updated_vote.id,
                    "vote_value": updated_vote.vote_value
                }
            }
    else:
        new_vote = create_vote(
            db, 
            current_user.userid,
            vote_data.votable_type,
            vote_data.votable_id,
            vote_data.vote_value
        )
        update_votable_counts(db, vote_data.votable_type, vote_data.votable_id)
        return {
            "message": "Vote created",
            "vote": {
                "id": new_vote.id,
                "vote_value": new_vote.vote_value
            }
        }


@app.delete("/votes/{votable_type}/{votable_id}")
def remove_vote(
    votable_type: str,
    votable_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Remove a vote from a file or folder"""
    existing_vote = get_vote(
        db, 
        current_user.userid, 
        votable_type, 
        votable_id
    )
    
    if not existing_vote:
        raise HTTPException(
            status_code=404,
            detail="Vote not found"
        )
    
    delete_vote(db, existing_vote)
    update_votable_counts(db, votable_type, votable_id)
    return {"message": "Vote removed successfully"}


@app.get("/votes/{votable_type}/{votable_id}/stats", response_model=VoteStats)
def get_vote_statistics(
    votable_type: str,
    votable_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get voting statistics for a file or folder"""
    if votable_type not in ["file", "folder"]:
        raise HTTPException(
            status_code=400, 
            detail="votable_type must be 'file' or 'folder'"
        )
    
    stats = get_vote_stats(
        db, 
        votable_type, 
        votable_id,
        user_id=current_user.userid
    )
    return stats


@app.get("/votes/me")
def get_my_votes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    skip: int = 0,
    limit: int = 100
):
    """Get current user's voting history"""
    votes = get_user_votes(db, current_user.userid, skip, limit)
    
    return {
        "votes": [
            {
                "id": v.id,
                "votable_type": v.votable_type,
                "votable_id": v.votable_id,
                "vote_value": v.vote_value,
                "created_at": v.created_at
            }
            for v in votes
        ]
    }

app.include_router(notes_router)
app.include_router(users_router)