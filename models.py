"""Database models voor gebruikers en leads."""

import os
from datetime import datetime

from flask_login import UserMixin
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash

db = SQLAlchemy()


class User(UserMixin, db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    # Telefoonnummer van de accountmanager: komt in de handtekening van elke mail
    phone = db.Column(db.String(30), default="")
    # Functie/titel (bijv. "New Business Accountmanager"): komt in de handtekening.
    # Leeg = de standaardtitel uit het sjabloon blijft staan.
    functie = db.Column(db.String(80), default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    leads = db.relationship("Lead", backref="owner", lazy=True, cascade="all, delete-orphan")

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)


class Lead(db.Model):
    __tablename__ = "leads"
    id = db.Column(db.String(36), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    data = db.Column(db.JSON, nullable=False)
    # Apart van `data`: screenshots zijn honderden KB en mogen nooit
    # meegeladen worden bij het ophalen van de leadslijst
    screenshot = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)