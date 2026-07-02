"""Lokale test: /api/leads zonder screenshots + apart screenshot-endpoint."""
import base64
import uuid

import app as leadapp
from models import Lead, User, db

# Mini rood PNG'tje van 1x1 pixel als nep-screenshot
PNG_1PX = base64.b64encode(bytes.fromhex(
    "89504e470d0a1a0a0000000d494844520000000100000001080600000"
    "01f15c4890000000d49444154789c626001000000ffff030000060005"
    "57bfabd40000000049454e44ae426082"
)).decode()

with leadapp.app.app_context():
    db.drop_all()
    db.create_all()
    user = User(name="Test", email="test@test.nl")
    user.set_password("test123")
    db.session.add(user)
    db.session.commit()
    lead_id = str(uuid.uuid4())
    db.session.add(Lead(id=lead_id, user_id=user.id, data={
        "id": lead_id, "name": "Testclub", "city": "Teststad",
        "screenshot": f"data:image/png;base64,{PNG_1PX}",
        "website": "https://example.nl",
    }))
    db.session.commit()

client = leadapp.app.test_client()
client.post("/login", data={"email": "test@test.nl", "password": "test123"})

r = client.get("/api/leads")
leads = r.get_json()
assert len(leads) == 1, f"verwacht 1 lead, kreeg {len(leads)}"
assert "screenshot" not in leads[0], "screenshot zit nog in de lijst!"
assert leads[0]["has_screenshot"] is True, "has_screenshot ontbreekt of is False"
print("OK: lijst is licht (geen screenshot, wel has_screenshot)")

r = client.get(f"/api/leads/{lead_id}/screenshot")
assert r.status_code == 200, f"screenshot-endpoint gaf {r.status_code}"
assert r.mimetype == "image/png", f"verkeerd mimetype: {r.mimetype}"
assert r.data[:8] == b"\x89PNG\r\n\x1a\n", "geen geldige PNG-bytes"
print("OK: screenshot-endpoint levert de echte afbeelding")

# Andermans lead mag niet opvraagbaar zijn
with leadapp.app.app_context():
    other = User(name="Ander", email="ander@test.nl")
    other.set_password("test123")
    db.session.add(other)
    db.session.commit()
client2 = leadapp.app.test_client()
client2.post("/login", data={"email": "ander@test.nl", "password": "test123"})
r = client2.get(f"/api/leads/{lead_id}/screenshot")
assert r.status_code == 404, f"andere gebruiker kreeg {r.status_code} i.p.v. 404"
print("OK: screenshot van een andere gebruiker is afgeschermd")
