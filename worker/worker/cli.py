from __future__ import annotations

import argparse

from worker.db import get_session
from worker.discovery import discover_articles
from worker.extraction import extract_articles
from worker.fetching import fetch_queued_articles
from worker.routing import reset_extraction_state, route_extractions


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Puerto Rico Coastal Watch worker")
    subparsers = parser.add_subparsers(dest="command", required=True)

    discover_parser = subparsers.add_parser("discover", help="Discover candidate URLs from Tavily")
    discover_parser.add_argument("--max-results", type=int, default=5)

    fetch_parser = subparsers.add_parser("fetch", help="Fetch and clean queued articles")
    fetch_parser.add_argument("--limit", type=int, default=10)

    extract_parser = subparsers.add_parser("extract", help="Extract structured data from cleaned articles")
    extract_parser.add_argument("--limit", type=int, default=10)

    route_parser = subparsers.add_parser("route", help="Create review items and case candidates")
    route_parser.add_argument("--limit", type=int, default=20)

    reprocess_parser = subparsers.add_parser(
        "reprocess",
        help="Clear extracted/routed state and rebuild it from existing cleaned articles",
    )
    reprocess_parser.add_argument("--limit", type=int, default=200)

    run_parser = subparsers.add_parser("run-once", help="Run discovery, fetch, extract, and routing once")
    run_parser.add_argument("--max-results", type=int, default=5)
    run_parser.add_argument("--limit", type=int, default=10)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    with get_session() as session:
        if args.command == "discover":
            print(discover_articles(session, max_results=args.max_results))
            return

        if args.command == "fetch":
            print(fetch_queued_articles(session, limit=args.limit))
            return

        if args.command == "extract":
            print(extract_articles(session, limit=args.limit))
            return

        if args.command == "route":
            print(route_extractions(session, limit=args.limit))
            return

        if args.command == "reprocess":
            cleared = reset_extraction_state(session)
            extracted = extract_articles(session, limit=args.limit)
            routed = route_extractions(session, limit=args.limit * 2)
            print({"cleared": cleared, "extract": extracted, "route": routed})
            return

        if args.command == "run-once":
            try:
                discovered = discover_articles(session, max_results=args.max_results)
            except Exception as exc:
                discovered = {"discovered": 0, "skipped": str(exc)}

            fetched = fetch_queued_articles(session, limit=args.limit)
            extracted = extract_articles(session, limit=args.limit)
            routed = route_extractions(session, limit=args.limit * 2)
            print(
                {
                    "discover": discovered,
                    "fetch": fetched,
                    "extract": extracted,
                    "route": routed,
                }
            )
            return

    parser.error("Unsupported command")


if __name__ == "__main__":
    main()
