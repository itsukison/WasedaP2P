#from sqlalchemy import Column, String, Integer, Boolean, Enum, DateTime, ForeignKey, Index, Sequence
from sqlalchemy import Column, String, Integer, Boolean, Enum, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from db_init import Base
import enum
from datetime import datetime
from models_notes import Note, NoteReport
from models_users import Timetable, TimetableEntry, Faculty, Department, Course

#shared_id_seq = Sequence("shared_id_seq")

class UserRole(enum.Enum):
    admin = "admin"
    user = "user"

class UserModel(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    email = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.user)
    disabled = Column(Boolean, default=False)
    email_verified = Column(Boolean, nullable=False, default=False)

    folders = relationship(
        "Folder",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True
    )

    files = relationship(
        "File",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True
    )

class Folder(Base):
    __tablename__ = "folders"

    #id = Column(Integer, shared_id_seq, primary_key=True, server_default=shared_id_seq.next_value())
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    path = Column(String, nullable=False)
    depth = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    upvote_count = Column(Integer, default=0, nullable=False)
    downvote_count = Column(Integer, default=0, nullable=False)
    user_id = Column(
        Integer, 
        ForeignKey("users.id", ondelete="CASCADE"), 
        index=True
    )

    user = relationship(
        "UserModel",
        back_populates="folders"
    )

    files = relationship(
        "File",
        back_populates="folder",
        cascade="all, delete-orphan",
        passive_deletes=True
    )

    __table_args__ = (
        Index("ix_user_path", "user_id", "path", unique=True),
    )

class File(Base):
    __tablename__ = "files"

    #id = Column(Integer, shared_id_seq, primary_key=True, server_default=shared_id_seq.next_value())
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    parent_folder_id = Column(
        Integer, 
        ForeignKey("folders.id", ondelete="CASCADE"),
        index=True
    )
    user_id = Column(
        Integer, 
        ForeignKey("users.id", ondelete="CASCADE"), 
        index=True
    )
    upvote_count = Column(Integer, default=0, nullable=False)
    downvote_count = Column(Integer, default=0, nullable=False)
    user = relationship(
        "UserModel",
        back_populates="files"
    )

    folder = relationship(
        "Folder",
        back_populates="files"
    )

    __table_args__ = (
        Index("ix_folder_name", "parent_folder_id", "name", unique=True),
    )
class Vote(Base):
    __tablename__ = "votes"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(
        Integer, 
        ForeignKey("users.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    votable_type = Column(String(50), nullable=False)
    votable_id = Column(Integer, nullable=False)
    vote_value = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("UserModel", backref="votes")
    
    __table_args__ = (
        Index("ix_user_votable", "user_id", "votable_type", "votable_id", unique=True),
        Index("ix_votable", "votable_type", "votable_id"),
    )
