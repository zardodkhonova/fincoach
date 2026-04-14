"""
generate_sample.py — Build a plausible fake bank CSV for testing ingest / the Gradio app.

Run: python generate_sample.py
Output: sample.csv (60 rows, last ~90 days)
"""

from __future__ import annotations

import csv
import random
from datetime import date, timedelta
from pathlib import Path

# Fixed seed so the file is reproducible across runs.
random.seed(42)

OUTPUT = Path(__file__).resolve().parent / "sample.csv"

# Merchant-style strings per category (amounts applied separately).
DESCRIPTIONS: dict[str, list[str]] = {
    "Food": [
        "WHOLE FOODS MARKET #1021",
        "TRADER JOE'S #234",
        "STARBUCKS STORE 8842",
        "CHIPOTLE ONLINE",
        "UBER EATS *ORDER",
        "DOORDASH *RESTAURANT",
        "COSTCO WHSE #0333",
        "LOCAL BAKERY & CAFE",
        "INSTACART *GROCERY",
    ],
    "Transport": [
        "SHELL OIL 57442100000",
        "UBER *TRIP",
        "LYFT *RIDE",
        "METRO TRANSIT MONTHLY",
        "PARKING METER ZONE 4",
        "AMTRAK TICKETS",
        "BP #9283 FUEL",
    ],
    "Shopping": [
        "AMAZON.COM*AMZN.COM/BILL",
        "TARGET T-2841",
        "BEST BUY #01882",
        "IKEA US EAST",
        "APPLE.COM/BILL",
        "NIKE.COM US",
        "HOMEGOODS #441",
    ],
    "Utilities": [
        "ELECTRIC CO MONTHLY SERVICE",
        "CITY WATER & SEWER",
        "INTERNET FIBER LLC",
        "NATURAL GAS SUPPLY CO",
        "MOBILE CARRIER AUTO PAY",
    ],
    "Entertainment": [
        "NETFLIX.COM SUBSCRIPTION",
        "SPOTIFY USA",
        "AMC THEATRES #12",
        "STEAM PURCHASE",
        "KINDLE UNLIMITED",
        "HBO MAX SUBSCRIPTION",
    ],
    "Health": [
        "CVS/PHARMACY #8841",
        "WALGREENS #1192",
        "DENTAL CARE PARTNERS",
        "URGENT CARE COPAY",
        "GYM MEMBERSHIP MONTHLY",
        "OPTOMETRIST CO-PAY",
    ],
}

CATEGORIES = list(DESCRIPTIONS.keys())


def random_amount(category: str) -> float:
    """Roughly realistic ranges; negative = debit (money out)."""
    ranges = {
        "Food": (8.0, 120.0),
        "Transport": (4.5, 85.0),
        "Shopping": (12.0, 350.0),
        "Utilities": (35.0, 220.0),
        "Entertainment": (6.99, 45.0),
        "Health": (15.0, 180.0),
    }
    low, high = ranges[category]
    return -round(random.uniform(low, high), 2)


def main() -> None:
    today = date.today()
    start = today - timedelta(days=90)

    rows: list[tuple[date, str, float, str]] = []
    for _ in range(60):
        d = start + timedelta(days=random.randint(0, 90))
        cat = random.choice(CATEGORIES)
        desc = random.choice(DESCRIPTIONS[cat])
        amt = random_amount(cat)
        rows.append((d, desc, amt, cat))

    rows.sort(key=lambda r: r[0])

    with OUTPUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["Date", "Description", "Amount", "Category"])
        for d, desc, amt, cat in rows:
            w.writerow([d.isoformat(), desc, f"{amt:.2f}", cat])

    # Avoid printing non-ASCII paths on Windows consoles that use a legacy code page.
    print(f"Wrote {len(rows)} rows to {OUTPUT.name}")


if __name__ == "__main__":
    main()
