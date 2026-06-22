"""Debug script to see what Google Maps actually renders."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    context = browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        viewport={"width": 1280, "height": 800},
    )
    page = context.new_page()
    page.goto("https://www.google.com/maps/search/restaurants+in+Amsterdam", wait_until="networkidle")
    page.wait_for_timeout(4000)

    # Accept cookies
    for text in ["Accept all", "Alles accepteren", "Akkoord"]:
        try:
            page.click(f'button:has-text("{text}")', timeout=2000)
            page.wait_for_timeout(1000)
            print(f"Clicked: {text}")
            break
        except Exception:
            pass

    page.wait_for_timeout(3000)

    # Try different selectors
    selectors = [
        'a[href*="/maps/place/"]',
        'div[role="feed"]',
        '.Nv2PK',
        '[jsaction*="mouseover:pane"]',
        'div.lI9IFe',
    ]

    for sel in selectors:
        els = page.query_selector_all(sel)
        print(f"Selector '{sel}': found {len(els)} elements")

    # Print first few links
    links = page.query_selector_all('a[href*="/maps/place/"]')
    for i, link in enumerate(links[:5]):
        try:
            label = link.get_attribute("aria-label") or link.inner_text()[:50]
            print(f"  Link {i}: {label}")
        except Exception as e:
            print(f"  Link {i}: error - {e}")

    input("Press Enter to close browser...")
    browser.close()
