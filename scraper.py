"""
Lead Finder — scrapes Google Maps, checks websites, finds emails, writes cold emails.
Usage: python scraper.py --niche "restaurants" --city "Amsterdam" --max 20
"""

import argparse
import csv
import re
import os
from datetime import datetime

import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

OUTPUT_FIELDNAMES = [
    "name", "niche", "city", "address", "phone",
    "website", "website_status", "email", "cold_email"
]


# ── Google Maps scraper ───────────────────────────────────────────────────────

def scrape_google_maps(niche: str, city: str, max_results: int) -> list[dict]:
    query = f"{niche} in {city}"
    print(f"\nSearching Google Maps for: {query}")
    businesses = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800},
        )
        page = context.new_page()
        page.goto(
            f"https://www.google.com/maps/search/{query.replace(' ', '+')}",
            wait_until="domcontentloaded",
            timeout=60000
        )
        page.wait_for_timeout(3000)

        # Accept cookies
        for text in ["Accept all", "Alles accepteren", "Akkoord", "I agree"]:
            try:
                page.click(f'button:has-text("{text}")', timeout=2000)
                page.wait_for_timeout(1000)
                break
            except Exception:
                pass

        page.wait_for_timeout(2000)

        # Step 1: collect all place URLs by scrolling the results panel
        place_urls = []
        seen_names = set()
        no_new_count = 0

        while len(place_urls) < max_results:
            cards = page.query_selector_all('a[href*="/maps/place/"]')
            before = len(place_urls)

            for card in cards:
                if len(place_urls) >= max_results:
                    break
                name = (card.get_attribute("aria-label") or "").strip()
                href = (card.get_attribute("href") or "").strip()
                if name and href and name not in seen_names:
                    seen_names.add(name)
                    place_urls.append((name, href))

            if len(place_urls) == before:
                no_new_count += 1
                if no_new_count >= 3:
                    break
            else:
                no_new_count = 0

            # Scroll to load more
            feed = page.query_selector('div[role="feed"]')
            if feed:
                feed.evaluate("el => el.scrollBy(0, 800)")
                page.wait_for_timeout(1500)
            else:
                break

        print(f"  Found {len(place_urls)} listings, fetching details...")

        # Step 2: visit each place page for details
        for name, href in place_urls:
            try:
                page.goto(href, wait_until="domcontentloaded", timeout=60000)
                page.wait_for_timeout(2500)

                address, phone, website = "", "", ""

                try:
                    el = page.query_selector('[data-item-id="address"] .fontBodyMedium')
                    if not el:
                        el = page.query_selector('button[data-item-id="address"]')
                    if el:
                        address = el.inner_text().strip()
                except Exception:
                    pass

                try:
                    els = page.query_selector_all('[data-item-id^="phone"]')
                    for el in els:
                        t = el.inner_text().strip()
                        if t:
                            phone = t
                            break
                except Exception:
                    pass

                try:
                    el = page.query_selector('a[data-item-id="authority"]')
                    if el:
                        website = el.get_attribute("href") or el.inner_text().strip()
                    else:
                        el = page.query_selector('[data-item-id="authority"]')
                        if el:
                            website = el.inner_text().strip()
                except Exception:
                    pass

                businesses.append({
                    "name": name,
                    "niche": niche,
                    "city": city,
                    "address": address,
                    "phone": phone,
                    "website": website,
                    "website_status": "",
                    "email": "",
                    "cold_email": "",
                })
                print(f"  [{len(businesses)}] {name} — {website or 'no website'}")

            except Exception:
                continue

        browser.close()

    return businesses


# ── Website checker ───────────────────────────────────────────────────────────

def check_website(website: str) -> str:
    if not website:
        return "missing"

    url = website if website.startswith("http") else f"https://{website}"
    try:
        r = requests.get(url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})
        if r.status_code >= 400:
            return "bad"

        soup = BeautifulSoup(r.text, "html.parser")
        text = soup.get_text()
        word_count = len(text.split())
        has_contact = any(w in text.lower() for w in ["contact", "email", "phone", "tel"])
        is_mobile_ready = "viewport" in r.text.lower()

        if word_count < 100 or not has_contact or not is_mobile_ready:
            return "bad"
        return "ok"

    except Exception:
        return "bad"


# ── Email finder ──────────────────────────────────────────────────────────────

def find_email(website: str) -> str:
    if not website:
        return ""

    url = website if website.startswith("http") else f"https://{website}"
    pages = [url, url.rstrip("/") + "/contact", url.rstrip("/") + "/about"]
    pattern = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
    junk = ["example", "sentry", "wix", "wordpress", "schema", ".png", ".jpg", "noreply"]

    for page_url in pages:
        try:
            r = requests.get(page_url, timeout=6, headers={"User-Agent": "Mozilla/5.0"})
            emails = [e for e in pattern.findall(r.text)
                      if not any(j in e.lower() for j in junk)]
            if emails:
                return emails[0]
        except Exception:
            continue

    return ""


# ── Cold email writer ─────────────────────────────────────────────────────────

def write_cold_email(business: dict) -> str:
    name = business["name"]
    niche = business["niche"]
    city = business["city"]
    status = business["website_status"]

    if status == "missing":
        problem = f"{name} currently has no website"
        pain = "potential customers who search for you online cannot find you and go to a competitor instead"
    else:
        problem = f"{name}'s website has some issues that could be costing you customers"
        pain = "visitors often leave within seconds if a site loads slowly, is not mobile-friendly, or looks outdated"

    return f"""Subject: Quick question about {name}'s online presence

Hi,

I was looking for {niche} in {city} and came across {name}.

{problem.capitalize()} — and {pain}.

I build clean, professional websites for local businesses that help them show up on Google and turn visitors into customers. Most of my clients see more calls and inquiries within the first month.

Would it be worth a quick 15-minute chat to see if I can help?

No pressure — just a conversation.

Best regards,
[Your Name]
[Your Phone]
[Your Website]"""


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--niche", required=True, help="e.g. restaurants")
    parser.add_argument("--city", required=True, help="e.g. Amsterdam")
    parser.add_argument("--max", type=int, default=20)
    args = parser.parse_args()

    businesses = scrape_google_maps(args.niche, args.city, args.max)

    print(f"\nChecking websites and finding emails for {len(businesses)} businesses...")
    for b in businesses:
        b["website_status"] = check_website(b["website"])
        b["email"] = find_email(b["website"])
        b["cold_email"] = write_cold_email(b)
        status = {"missing": "[NO WEBSITE]", "bad": "[BAD WEBSITE]", "ok": "[OK]"}.get(b["website_status"], "?")
        safe_name = b['name'].encode('ascii', 'replace').decode('ascii')
        print(f"  {status} {safe_name} — email: {b['email'] or 'not found'}")

    # Save CSV
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"leads_{args.niche}_{args.city}_{timestamp}.csv".replace(" ", "_")
    filepath = os.path.join(os.path.dirname(os.path.abspath(__file__)), filename)

    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_FIELDNAMES)
        writer.writeheader()
        writer.writerows(businesses)

    missing = sum(1 for b in businesses if b["website_status"] == "missing")
    bad = sum(1 for b in businesses if b["website_status"] == "bad")
    with_email = sum(1 for b in businesses if b["email"])

    print(f"""
-----------------------------------
Done! Found {len(businesses)} businesses
  No website:  {missing}
  Bad website: {bad}
  With email:  {with_email}
  Saved to:    {filename}
-----------------------------------
""")


if __name__ == "__main__":
    main()
