"""
models.py — SQLAlchemy models for users, uploaded file metadata, and chat history.
"""

from __future__ import annotations

from datetime import datetime

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    plan = db.Column(db.String(32), nullable=False, default="free")
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    files = db.relationship("UserFile", backref="user", lazy=True)
    messages = db.relationship("ChatMessage", backref="user", lazy=True)


class UserFile(db.Model):
    __tablename__ = "user_files"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    filename = db.Column(db.String(512), nullable=False)
    row_count = db.Column(db.Integer, nullable=False)
    uploaded_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)


class ChatMessage(db.Model):
    __tablename__ = "chat_messages"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    role = db.Column(db.String(32), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
