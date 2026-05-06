from __future__ import annotations

import argparse

from worker.db import get_session
from worker.discovery import discover_articles
from worker.extraction import extract_articles
from worker.fetching import fetch_queued_articles
from worker.logging_utils import configure_logging, get_logger, log_event
from worker.reporting import summarize_worker_state
from worker.routing import reset_extraction_state, route_extractions


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Puerto Rico Coastal Watch worker")
    subparsers = parser.add_subparsers(dest="command", required=True)

    discover_parser = subparsers.add_parser("discover", help="Discover candidate URLs with OpenAI web search")
    discover_parser.add_argument("--max-results", type=int, default=5)
    discover_parser.add_argument("--fast", action="store_true", help="Run a minimal smoke-test discovery pass")

    fetch_parser = subparsers.add_parser("fetch", help="Fetch and clean queued articles from discovered URLs")
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

    summary_parser = subparsers.add_parser("summary", help="Summarize current worker and publication state")
    summary_parser.add_argument("--recent-limit", type=int, default=10)

    run_parser = subparsers.add_parser("run-once", help="Run discovery, fetch, extract, and routing once")
    run_parser.add_argument("--max-results", type=int, default=5)
    run_parser.add_argument("--limit", type=int, default=10)
    run_parser.add_argument("--fast", action="store_true", help="Run a minimal smoke-test discovery pass")

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    configure_logging()
    logger = get_logger("worker.cli")

    with get_session() as session:
        if args.command == "discover":
            log_event(
                logger,
                "worker.command.start",
                command=args.command,
                max_results=args.max_results,
                fast=args.fast,
            )
            print(discover_articles(session, max_results=args.max_results, fast=args.fast))
            return

        if args.command == "fetch":
            log_event(logger, "worker.command.start", command=args.command, limit=args.limit)
            print(fetch_queued_articles(session, limit=args.limit))
            return

        if args.command == "extract":
            log_event(logger, "worker.command.start", command=args.command, limit=args.limit)
            print(extract_articles(session, limit=args.limit))
            return

        if args.command == "route":
            log_event(logger, "worker.command.start", command=args.command, limit=args.limit)
            print(route_extractions(session, limit=args.limit))
            return

        if args.command == "reprocess":
            log_event(logger, "worker.command.start", command=args.command, limit=args.limit)
            cleared = reset_extraction_state(session)
            extracted = extract_articles(session, limit=args.limit)
            routed = route_extractions(session, limit=args.limit * 2)
            print({"cleared": cleared, "extract": extracted, "route": routed})
            return

        if args.command == "summary":
            log_event(logger, "worker.command.start", command=args.command, recent_limit=args.recent_limit)
            print(summarize_worker_state(session, recent_limit=args.recent_limit))
            return

        if args.command == "run-once":
            log_event(
                logger,
                "worker.command.start",
                command=args.command,
                max_results=args.max_results,
                limit=args.limit,
                fast=args.fast,
            )
            try:
                discovered = discover_articles(session, max_results=args.max_results, fast=args.fast)
            except Exception as exc:
                log_event(
                    logger,
                    "worker.discovery.error",
                    level=40,
                    message="discovery failed during run-once",
                    error=str(exc),
                )
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
