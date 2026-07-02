"""Diagnose: test de kritieke onderdelen van de Lead Finder app."""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from playwright.sync_api import sync_playwright

def test_google_maps():
    print("=" * 60)
    print("TEST 1: Google Maps scraper")
    print("=" * 60)
    query = "tennisvereniging Utrecht"
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800},
        )
        page = context.new_page()
        try:
            page.goto(f"https://www.google.com/maps/search/{query.replace(' ', '+')}",
                      wait_until="domcontentloaded", timeout=30000)
        except Exception as e:
            print(f"FOUT bij laden Google Maps: {e}")
            browser.close()
            return
        page.wait_for_timeout(2500)
        print(f"URL na laden: {page.url}")
        print(f"Paginatitel: {page.title()}")

        # Consent knop?
        clicked = False
        for text in ["Alles accepteren", "Accept all", "Akkoord"]:
            try:
                page.click(f'button:has-text("{text}")', timeout=1500)
                clicked = True
                print(f"Consent-knop geklikt: '{text}'")
                page.wait_for_timeout(1500)
                break
            except Exception:
                pass
        if not clicked:
            print("Geen consent-knop gevonden (of al geaccepteerd)")

        print(f"URL nu: {page.url}")
        cards = page.query_selector_all('a[href*="/maps/place/"]')
        print(f"Aantal resultaatkaarten gevonden: {len(cards)}")
        for card in cards[:5]:
            name = (card.get_attribute("aria-label") or "").strip()
            print(f"  - {name}")

        feed = page.query_selector('div[role="feed"]')
        print(f"Feed element aanwezig: {feed is not None}")

        if len(cards) == 0:
            body_text = page.inner_text("body")[:500]
            print(f"\nEerste 500 tekens van pagina:\n{body_text}")
            page.screenshot(path="diagnose_maps.png")
            print("\nScreenshot opgeslagen als diagnose_maps.png")
        browser.close()


def test_ddgs():
    print()
    print("=" * 60)
    print("TEST 2: DuckDuckGo zoeken (ddgs)")
    print("=" * 60)
    try:
        from ddgs import DDGS
        with DDGS() as d:
            results = list(d.text("tennisvereniging Utrecht", max_results=3))
        print(f"Aantal resultaten: {len(results)}")
        for r in results:
            print(f"  - {r.get('title', '?')[:60]}")
    except Exception as e:
        print(f"FOUT: {type(e).__name__}: {e}")


def test_nominatim():
    print()
    print("=" * 60)
    print("TEST 3: Nominatim / Overpass (omliggende plaatsen)")
    print("=" * 60)
    import requests
    try:
        r = requests.get("https://nominatim.openstreetmap.org/search",
                         params={"q": "Utrecht, Nederland", "format": "json", "limit": 1},
                         headers={"User-Agent": "HeinekenLeadFinder/1.0"}, timeout=5)
        print(f"Nominatim status: {r.status_code}, resultaten: {len(r.json())}")
    except Exception as e:
        print(f"FOUT Nominatim: {type(e).__name__}: {e}")


if __name__ == "__main__":
    test_google_maps()
    test_ddgs()
    test_nominatim()
