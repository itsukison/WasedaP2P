from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.orm import relationship
from db_init import Base


class Timetable(Base):
    __tablename__ = "timetables"

    id = Column(Integer, primary_key=True, autoincrement=True)
    semester = Column(String, nullable=False)
    year = Column(Integer, nullable=False)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    user = relationship("UserModel", backref="timetables")
    entries = relationship(
        "TimetableEntry",
        back_populates="timetable",
        cascade="all, delete-orphan"
    )


class TimetableEntry(Base):
    __tablename__ = "timetable_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    course_id = Column(String, nullable=True)
    course_name = Column(String, nullable=False)
    professor = Column(String, nullable=True)
    room = Column(String, nullable=True)
    day = Column(String, nullable=False)
    period = Column(Integer, nullable=False)
    timetable_id = Column(
        Integer,
        ForeignKey("timetables.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    timetable = relationship("Timetable", back_populates="entries")

class Faculty(Base):
    __tablename__ = "faculties"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True)

    departments = relationship(
        "Department",
        back_populates="faculty",
        cascade="all, delete-orphan"
    )


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    faculty_id = Column(
        Integer,
        ForeignKey("faculties.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    faculty = relationship("Faculty", back_populates="departments")
    courses = relationship(
        "Course",
        back_populates="department",
        cascade="all, delete-orphan"
    )


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    professor = Column(String, nullable=True)
    department_id = Column(
        Integer,
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    department = relationship("Department", back_populates="courses")