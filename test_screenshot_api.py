"""Lokale test: screenshots in aparte kolom, lichte /api/leads-lijst, migratie."""
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
DATA_URI = f"data:image/png;base64,{PNG_1PX}"

with leadapp.app.app_context():
    db.drop_all()
    db.create_all()
    user = User(name="Test", email="test@test.nl")
    user.set_password("test123")
    db.session.add(user)
    db.session.commit()
    user_id = user.id

    # Oude situatie nabootsen: screenshot ín de data-JSON
    old_lead_id = str(uuid.uuid4())
    db.session.add(Lead(id=old_lead_id, user_id=user_id, data={
        "id": old_lead_id, "name": "Oude club", "city": "Teststad",
        "screenshot": DATA_URI, "website": "https://oud.nl",
    }))
    db.session.commit()

    # Migratie draaien zoals bij het opstarten gebeurt
    leadapp._migrate_screenshots_to_column()
    row = db.session.get(Lead, old_lead_id)
    assert row.screenshot == DATA_URI, "migratie: screenshot niet naar kolom verplaatst"
    assert "screenshot" not in (row.data or {}), "migratie: screenshot zit nog in data-JSON"
    print("OK: migratie verplaatst bestaande screenshots naar de kolom")

    # Nieuwe situatie: opslaan via save_leads met screenshot in de dict
    new_lead_id = str(uuid.uuid4())
    leadapp.save_leads([
        dict(row.data, has_screenshot=True),
        {"id": new_lead_id, "name": "Nieuwe club", "city": "Teststad",
         "screenshot": DATA_URI, "website": "https://nieuw.nl"},
    ], user_id)
    row2 = db.session.get(Lead, new_lead_id)
    assert row2.screenshot == DATA_URI, "save: screenshot niet in kolom beland"
    assert "screenshot" not in (row2.data or {}), "save: screenshot zit in data-JSON"
    assert "has_screenshot" not in (db.session.get(Lead, old_lead_id).data or {}), "save: has_screenshot-vlag lekt naar data-JSON"
    print("OK: opslaan routeert screenshots naar de kolom")

client = leadapp.app.test_client()
client.post("/login", data={"email": "test@test.nl", "password": "test123"})

r = client.get("/api/leads")
leads = r.get_json()
assert len(leads) == 2, f"verwacht 2 leads, kreeg {len(leads)}"
for l in leads:
    assert "screenshot" not in l, "screenshot zit nog in de lijst!"
    assert l["has_screenshot"] is True, "has_screenshot ontbreekt of is False"
print("OK: lijst is licht (geen screenshot, wel has_screenshot)")

r = client.get(f"/api/leads/{old_lead_id}/screenshot")
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
r = client2.get(f"/api/leads/{old_lead_id}/screenshot")
assert r.status_code == 404, f"andere gebruiker kreeg {r.status_code} i.p.v. 404"
print("OK: screenshot van een andere gebruiker is afgeschermd")
