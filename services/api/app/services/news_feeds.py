"""RSS feed ingestion from western news outlets."""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime

import feedparser
import httpx

# Western mainstream outlets — no RT, Al Jazeera, etc.
WESTERN_RSS_FEEDS: list[tuple[str, str]] = [
    ("BBC World", "http://feeds.bbci.co.uk/news/world/rss.xml"),
    ("Reuters", "https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best"),
    ("CNN World", "http://rss.cnn.com/rss/edition_world.rss"),
    ("NPR World", "https://feeds.npr.org/1004/rss.xml"),
    ("The Guardian World", "https://www.theguardian.com/world/rss"),
    ("NYT World", "https://rss.nytimes.com/services/xml/rss/nyt/World.xml"),
    ("Fox News World", "https://moxie.foxnews.com/google-publisher/world.xml"),
    ("CBS News", "https://www.cbsnews.com/latest/rss/world"),
    ("ABC News Intl", "https://abcnews.go.com/abcnews/internationalheadlines"),
    ("Politico", "https://rss.politico.com/defense.xml"),
    ("NBC News World", "https://feeds.nbcnews.com/nbcnews/public/world"),
    ("USA Today World", "https://rss.usatoday.com/news/world"),
    ("Sky News World", "https://feeds.skynews.com/feeds/rss/world.xml"),
    ("DW English", "https://rss.dw.com/rdf/rss-en-world"),
    ("AP Top News", "https://rsshub.app/apnews/topics/apf-topnews"),
    ("Bloomberg Politics", "https://feeds.bloomberg.com/politics/news.rss"),
    ("The Atlantic", "https://www.theatlantic.com/feed/all/"),
    ("Time World", "https://time.com/section/world/feed/"),
]

FETCH_TIMEOUT = 12.0
USER_AGENT = "OpenEyesNewsBot/1.0 (+https://github.com/openeyes)"


@dataclass
class RawNewsArticle:
    """Article parsed from RSS before embedding/clustering."""

    id: str
    title: str
    url: str
    source_name: str
    summary: str | None
    published_at: str
    image_url: str | None


def _article_id(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:16]


def _parse_published(entry: feedparser.FeedParserDict) -> str:
    if entry.get("published_parsed"):
        try:
            dt = datetime(*entry.published_parsed[:6], tzinfo=UTC)
            return dt.isoformat()
        except (TypeError, ValueError):
            pass
    if entry.get("updated_parsed"):
        try:
            dt = datetime(*entry.updated_parsed[:6], tzinfo=UTC)
            return dt.isoformat()
        except (TypeError, ValueError):
            pass
    if entry.get("published"):
        try:
            return parsedate_to_datetime(entry["published"]).astimezone(UTC).isoformat()
        except (TypeError, ValueError, OverflowError):
            pass
    return datetime.now(tz=UTC).isoformat()


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text).strip()


def _extract_image(entry: feedparser.FeedParserDict) -> str | None:
    media = entry.get("media_content") or entry.get("media_thumbnail") or []
    for item in media:
        url = item.get("url")
        if url:
            return url
    for enc in entry.get("enclosures") or []:
        if enc.get("type", "").startswith("image") and enc.get("href"):
            return enc["href"]
    return None


def fetch_og_image(url: str, client: httpx.Client) -> str | None:
    """Fallback: scrape og:image from the article page."""
    try:
        resp = client.get(url, follow_redirects=True, timeout=FETCH_TIMEOUT)
        resp.raise_for_status()
        match = re.search(
            r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
            resp.text,
            re.IGNORECASE,
        )
        if match:
            return match.group(1)
        match = re.search(
            r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
            resp.text,
            re.IGNORECASE,
        )
        if match:
            return match.group(1)
    except Exception:  # noqa: BLE001 — best-effort image fetch
        return None
    return None


def fetch_rss_articles(max_articles: int) -> list[RawNewsArticle]:
    """Fetch recent articles from all configured RSS feeds."""
    seen_urls: set[str] = set()
    articles: list[RawNewsArticle] = []

    with httpx.Client(headers={"User-Agent": USER_AGENT}, follow_redirects=True) as client:
        for source_name, feed_url in WESTERN_RSS_FEEDS:
            if len(articles) >= max_articles:
                break
            try:
                resp = client.get(feed_url, timeout=FETCH_TIMEOUT)
                resp.raise_for_status()
                parsed = feedparser.parse(resp.content)
            except Exception:  # noqa: BLE001 — skip broken feeds
                continue

            for entry in parsed.entries:
                if len(articles) >= max_articles:
                    break
                link = (entry.get("link") or "").strip()
                title = _strip_html((entry.get("title") or "").strip())
                if not link or not title:
                    continue
                if link in seen_urls:
                    continue
                seen_urls.add(link)

                summary_raw = entry.get("summary") or entry.get("description")
                summary = _strip_html(summary_raw)[:500] if summary_raw else None
                image_url = _extract_image(entry)

                articles.append(
                    RawNewsArticle(
                        id=_article_id(link),
                        title=title,
                        url=link,
                        source_name=source_name,
                        summary=summary,
                        published_at=_parse_published(entry),
                        image_url=image_url,
                    )
                )

    articles.sort(key=lambda a: a.published_at, reverse=True)
    return articles[:max_articles]
