#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Estate Concierge site-index generator.

Scans every root *.html and osa/*.html page of the staging estate and writes
assets/js/concierge-index.js — a single `window.CONCIERGE_INDEX = {...}` payload
consumed by assets/js/concierge.js.

Everything in the index is EXTRACTED from the pages themselves (headings,
anchors, pricing tables, FAQ blocks, glance tiles, cards, phone numbers,
addresses, hours, booking links). Nothing is invented here; if a page does not
say it, the index does not carry it.

Stdlib only. Deterministic: fixed page order, sorted JSON keys, stable
extraction order — regeneration diffs cleanly (only the generated-at header
line moves).

Usage:  python3 tools/build_concierge_index.py
"""
import json
import os
import re
import sys
import datetime
from html import unescape
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "js", "concierge-index.js")

# page path -> (slug used on the data-page include attribute, campus)
PAGES = [
    ("index.html", "home", "tulsa"),
    ("surgeons.html", "surgeons", "tulsa"),
    ("fellowship.html", "fellowship", "tulsa"),
    ("library.html", "library", "tulsa"),
    ("gallery.html", "gallery", "tulsa"),
    ("pricing.html", "pricing", "tulsa"),
    ("rhinoplasty.html", "procedure-rhinoplasty", "tulsa"),
    ("medspa.html", "medspa", "tulsa"),
    ("wellness.html", "wellness", "tulsa"),
    ("store.html", "store", "tulsa"),
    ("contact.html", "contact", "tulsa"),
    ("oklahoma-city.html", "okc-guide", "okc"),
    ("privacy.html", "privacy", "tulsa"),
    ("accessibility.html", "accessibility", "tulsa"),
    ("404.html", "notfound", "tulsa"),
    ("verify.html", "verify", "tulsa"),
    ("osa/index.html", "osa-home", "okc"),
    ("osa/surgeons.html", "osa-surgeons", "okc"),
    ("osa/results.html", "osa-results", "okc"),
    ("osa/pricing.html", "osa-pricing", "okc"),
    ("osa/injectables.html", "osa-injectables", "okc"),
    ("osa/wellness.html", "osa-wellness", "okc"),
    ("osa/contact.html", "osa-contact", "okc"),
    ("osa/privacy.html", "osa-privacy", "okc"),
    ("osa/accessibility.html", "osa-accessibility", "okc"),
    ("osa/404.html", "osa-notfound", "okc"),
]

# very large case archives: index page-level info + filters only, not every case
BULK_GALLERY = {"gallery.html", "osa/results.html"}

VOID = {"img", "input", "br", "meta", "link", "hr", "source", "wbr", "area", "base", "col", "embed", "track", "param"}


class Node(object):
    __slots__ = ("tag", "attrs", "children", "parent")

    def __init__(self, tag, attrs, parent):
        self.tag = tag
        self.attrs = dict(attrs) if attrs else {}
        self.children = []  # Node or str
        self.parent = parent

    def cls(self):
        return (self.attrs.get("class") or "").split()

    def text(self):
        out = []
        for c in self.children:
            if isinstance(c, str):
                out.append(c)
            elif c.tag not in ("script", "style"):
                out.append(c.text())
        return "".join(out)

    def walk(self):
        yield self
        for c in self.children:
            if isinstance(c, Node):
                for n in c.walk():
                    yield n

    def find_all(self, tag=None, klass=None):
        for n in self.walk():
            if n is self:
                continue
            if tag and n.tag != tag:
                continue
            if klass and klass not in n.cls():
                continue
            yield n

    def first(self, tag=None, klass=None):
        for n in self.find_all(tag, klass):
            return n
        return None

    def nearest_id(self):
        n = self
        while n is not None:
            i = n.attrs.get("id")
            if i and i != "main":
                return i
            n = n.parent
        return None


class TreeBuilder(HTMLParser):
    def __init__(self):
        HTMLParser.__init__(self, convert_charrefs=True)
        self.root = Node("#root", {}, None)
        self.cur = self.root

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.cur)
        self.cur.children.append(node)
        if tag not in VOID:
            self.cur = node

    def handle_startendtag(self, tag, attrs):
        self.cur.children.append(Node(tag, attrs, self.cur))

    def handle_endtag(self, tag):
        n = self.cur
        while n is not None and n.tag != tag:
            n = n.parent
        if n is not None and n.parent is not None:
            self.cur = n.parent

    def handle_data(self, data):
        if data:
            self.cur.children.append(data)


def clean(s, limit=None):
    s = re.sub(r"\s+", " ", unescape(s or "")).strip()
    if limit and len(s) > limit:
        s = s[: limit - 1].rstrip() + "…"
    return s


def parse(path):
    with open(os.path.join(ROOT, path), encoding="utf-8") as f:
        raw = f.read()
    tb = TreeBuilder()
    tb.feed(raw)
    return tb.root, raw


def extract_page(path, slug, campus):
    root, raw = parse(path)
    page = {"path": path, "page": slug, "campus": campus}

    t = root.first("title")
    page["title"] = clean(t.text()) if t else path
    m = re.search(r'<meta name="description" content="([^"]*)"', raw)
    page["desc"] = clean(m.group(1)) if m else ""
    h1 = root.first("h1")
    page["h1"] = clean(h1.text()) if h1 else ""

    # headings + nearest anchors
    sections = []
    seen = set()
    max_level = 2 if path in BULK_GALLERY else 3
    for n in root.walk():
        if n.tag in ("h1", "h2", "h3") and int(n.tag[1]) <= max_level:
            txt = clean(n.text(), 120)
            if not txt:
                continue
            anchor = n.nearest_id()
            key = (txt, anchor)
            if key in seen:
                continue
            seen.add(key)
            sections.append({"t": txt, "l": int(n.tag[1]), "id": anchor})
    page["sections"] = sections

    # FAQ blocks (details.faq)
    faqs = []
    for d in root.find_all("details", "faq"):
        s = d.first("summary")
        body = None
        for c in d.children:
            if isinstance(c, Node) and c.tag == "div":
                body = c
        if s and body:
            faqs.append({"q": clean(s.text(), 160), "a": clean(body.text(), 420)})
    if faqs:
        page["faqs"] = faqs

    # glance tiles (procedure quick facts)
    g = root.first("div", "glance")
    if g is not None:
        pairs = []
        for cell in g.children:
            if isinstance(cell, Node) and cell.tag == "div":
                b = cell.first("b")
                sp = cell.first("span")
                if b and sp:
                    pairs.append([clean(b.text(), 60), clean(sp.text(), 120)])
        if pairs:
            page["glance"] = pairs

    # content cards (pcard / wcard / pillar / campuscard / vcard)
    if path not in BULK_GALLERY:
        cards = []
        for kl in ("pcard", "wcard", "pillar", "campuscard", "vcard"):
            for c in root.find_all("div", kl):
                h3 = c.first("h3")
                if not h3:
                    continue
                p = c.first("p", None)
                # first paragraph that is not a label
                para = ""
                for pn in c.find_all("p"):
                    if "label" in pn.cls() or "figcap" in pn.cls():
                        continue
                    para = clean(pn.text(), 300)
                    break
                items = [clean(li.text(), 140) for li in c.find_all("li")][:6]
                items = [i for i in items if i]
                cards.append({"t": clean(h3.text(), 90), "p": para, "items": items,
                              "id": c.nearest_id()})
        if cards:
            page["cards"] = cards[:24]

    # pricing table (table.costs)
    tbl = root.first("table", "costs")
    if tbl is not None:
        head = [clean(th.text(), 80) for th in tbl.find_all("th")]
        rows = []
        for tr in tbl.find_all("tr"):
            tds = [c for c in tr.children if isinstance(c, Node) and c.tag == "td"]
            if len(tds) < 3:
                continue
            name = clean(tds[0].text(), 90)
            avg = clean(tds[1].text(), 60)
            rng = clean(tds[2].text(), 90)
            src = ""
            if len(tds) > 3:
                a = tds[3].first("a")
                if a is not None:
                    src = a.attrs.get("href", "")
            rows.append({"name": name, "avg": avg, "range": rng, "src": src})
        page["pricing_head"] = head
        page["pricing_rows"] = rows

    # phone numbers actually published on this page
    phones = []
    for a in root.find_all("a"):
        href = a.attrs.get("href", "")
        if href.startswith("tel:"):
            num = href[4:]
            disp = clean(a.text(), 40)
            entry = {"tel": num, "disp": disp}
            if entry not in phones:
                phones.append(entry)
    if phones:
        page["phones"] = phones

    # addresses published on this page
    addrs = []
    for pat in (r"7322 E 91st St[^<•]*?OK\s*74133", r"12400 Saint Andrew[^<•]*?OK\s*73120"):
        m = re.search(pat, raw)
        if m:
            a = clean(m.group(0), 90)
            if a not in addrs:
                addrs.append(a)
    if addrs:
        page["addresses"] = addrs

    # hours strings as published
    hours = sorted(set(clean(h, 80) for h in re.findall(r"Mon–Thu[^<]{4,60}", raw)))
    if hours:
        page["hours"] = hours

    # maps links as published
    maps = []
    for m in re.findall(r'href="(https://maps\.google\.com/[^"]+)"', raw):
        if m not in maps:
            maps.append(m)
    if maps:
        page["maps"] = maps

    # surgeon profiles (article.prof with id)
    profs = []
    for art in root.find_all("article", "prof"):
        pid = art.attrs.get("id")
        name_el = art.first("h2", "pname") or art.first("h3")
        role_el = art.first("p", "role")
        if not (pid and name_el):
            continue
        badges = [clean(b.text(), 60) for b in art.find_all("span", "badge")]
        focus = ""
        for div in art.find_all("div"):
            b = div.first("b")
            if b and clean(b.text()) == "Focus":
                sp = div.first("span")
                if sp:
                    focus = clean(sp.text(), 220)
        profs.append({"id": pid, "name": clean(name_el.text(), 80),
                      "role": clean(role_el.text(), 120) if role_el else "",
                      "badges": badges, "focus": focus})
    if profs:
        page["surgeons"] = profs

    # gallery case archive: procedures + filters, not every case
    if path in BULK_GALLERY:
        counts = {}
        for m in re.finditer(r'id="(tsa|osa)-([a-z]+)-([a-z0-9-]+)-case(\d+)"', raw):
            if m.group(1) == "tsa":  # tsa-<surgeon>-<procedure>-caseNN
                proc = m.group(3).replace("-", " ")
            else:                    # osa-<procedure>-caseNN (campus case, no surgeon token)
                proc = (m.group(2) + " " + m.group(3)).replace("-", " ")
            counts[proc] = counts.get(proc, 0) + 1
        filters = re.findall(r'<button[^>]*class="chip[^"]*"[^>]*data-f="([a-z]+)"[^>]*(?:id="(f-[a-z]+)")?[^>]*>([^<]+)<', raw)
        page["gallery"] = {
            "procedures": [{"name": k, "cases": v} for k, v in sorted(counts.items())],
            "filters": [{"f": f[0], "id": (f[1] or ("f-" + f[0])), "label": clean(f[2], 40)} for f in filters],
        }

    # booking links this page itself publishes
    booking = []
    for m in re.finditer(r'href="(https://(?:tulsasurgicalarts\.com/book-appointment|form\.jotform\.com/\d+)[^"]*)"', raw):
        if m.group(1) not in booking:
            booking.append(m.group(1))
    if booking:
        page["booking"] = booking

    return page


def build():
    pages = []
    for path, slug, campus in PAGES:
        if not os.path.exists(os.path.join(ROOT, path)):
            print("MISSING PAGE: %s" % path, file=sys.stderr)
            sys.exit(1)
        pages.append(extract_page(path, slug, campus))

    by_path = dict((p["path"], p) for p in pages)

    # ---- locations: assembled ONLY from what the contact pages publish ----
    contact = by_path["contact.html"]
    osa_contact = by_path["osa/contact.html"]
    osa_index = by_path["osa/index.html"]

    def phone_for(page_list, prefix):
        for pg in page_list:
            for ph in pg.get("phones", []):
                if ph["tel"].startswith(prefix):
                    return ph
        return None

    tulsa_phone = phone_for([contact], "+1918")
    okc_phone = phone_for([osa_contact, contact], "+1405")
    locations = {
        "tulsa": {
            "name": "Tulsa Surgical Arts — the villa",
            "address": next((a for a in contact.get("addresses", []) if "74133" in a), ""),
            "tel": tulsa_phone["tel"] if tulsa_phone else "",
            "disp": tulsa_phone["disp"] if tulsa_phone else "",
            "hours": contact.get("hours", []),
            "maps": next((m for m in contact.get("maps", []) if "Tulsa" in m), ""),
            "page": "contact.html",
            "book": next((b for b in by_path["index.html"].get("booking", [])
                          if "book-appointment" in b), ""),
            "sms": "+19183920880" if "sms:+19183920880" in open(os.path.join(ROOT, "contact.html"), encoding="utf-8").read() else "",
        },
        "okc": {
            "name": "Oklahoma Surgical Arts — Oklahoma City",
            "address": next((a for a in osa_contact.get("addresses", []) if "73120" in a), ""),
            "tel": okc_phone["tel"] if okc_phone else "",
            "disp": okc_phone["disp"] if okc_phone else "",
            "hours": [],  # the estate does not publish OKC hours — never invent
            "maps": next((m for m in osa_contact.get("maps", []) if "73120" in m or "Saint" in m), ""),
            "page": "osa/contact.html",
            "book": next((b for b in osa_index.get("booking", []) if "jotform" in b), ""),
            "sms": "",
        },
    }

    # wellness consult form as published on wellness.html
    wellness_form = next((b for b in by_path["wellness.html"].get("booking", [])
                          if "jotform" in b), "")

    # store URL as published on store.html
    store_raw = open(os.path.join(ROOT, "store.html"), encoding="utf-8").read()
    m = re.search(r'href="(https://store\.tulsasurgicalarts\.com)[/"]', store_raw)
    store_url = m.group(1) if m else ""

    surgeons = []
    for p in pages:
        for s in p.get("surgeons", []):
            s2 = dict(s)
            s2["path"] = p["path"]
            surgeons.append(s2)

    idx = {
        "pages": pages,
        "locations": locations,
        "links": {"wellness_form": wellness_form, "store": store_url},
        "surgeons": surgeons,
        "pricing": {
            "tulsa": by_path["pricing.html"].get("pricing_rows", []),
            "okc": by_path["osa/pricing.html"].get("pricing_rows", []),
        },
        "gallery": {
            "tulsa": by_path["gallery.html"].get("gallery", {}),
            "okc": by_path["osa/results.html"].get("gallery", {}),
        },
    }

    stats = {
        "pages": len(pages),
        "sections": sum(len(p.get("sections", [])) for p in pages),
        "faqs": sum(len(p.get("faqs", [])) for p in pages),
        "cards": sum(len(p.get("cards", [])) for p in pages),
        "pricing_rows": len(idx["pricing"]["tulsa"]) + len(idx["pricing"]["okc"]),
        "surgeon_profiles": len(surgeons),
    }

    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    body = json.dumps(idx, ensure_ascii=False, sort_keys=True, indent=1)
    js = (
        "/* concierge-index.js — GENERATED FILE, do not hand-edit.\n"
        " * Rebuild with: python3 tools/build_concierge_index.py\n"
        " * generated-at: %s\n"
        " * stats: %s\n"
        " * Every value below is extracted from the estate's own pages. */\n"
        "window.CONCIERGE_INDEX = %s;\n" % (stamp, json.dumps(stats, sort_keys=True), body)
    )
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(js)
    print("wrote %s (%d bytes)" % (os.path.relpath(OUT, ROOT), len(js.encode("utf-8"))))
    print("stats:", json.dumps(stats, sort_keys=True))


if __name__ == "__main__":
    build()
