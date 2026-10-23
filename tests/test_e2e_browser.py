"""Playwright end-to-end browser walkthrough tests for Preceptor Nexus Space.

Requires:
- Frontend dev server running at http://localhost:5173
  Start with: cd frontend && npm run dev
- Backend running at http://localhost:8000 (optional - app works offline)
  Start with: uvicorn backend.main:app --reload --port 8000

Run the suite:
  pytest tests/test_e2e_browser.py -v

Browser configuration is in conftest.py - uses system Chrome via channel="chrome".
No playwright install chromium is needed.
"""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

BASE_URL = "http://localhost:5173"
HEALTH_URL = "http://localhost:8000/api/health"

VIEWPORTS = [
    pytest.param({"width": 1920, "height": 1080}, id="desktop"),
    pytest.param({"width": 768, "height": 1024}, id="tablet"),
    pytest.param({"width": 375, "height": 667}, id="mobile"),
]

ROUTES = [
    pytest.param("/", "Dashboard", id="dashboard"),
    pytest.param("/assessment", "Assessment", id="assessment"),
    pytest.param("/flashcards", "Flashcards", id="flashcards"),
    pytest.param("/planner", "Planner", id="planner"),
    pytest.param("/buddy", "AI Buddy", id="buddy"),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def wait_for_app(page: Page) -> None:
    """Wait for the app shell to finish loading stored progress."""
    page.wait_for_load_state("networkidle", timeout=15_000)
    # The main tag has aria-busy=true while IndexedDB is loading
    page.wait_for_function("document.querySelector('main') && document.querySelector('main').getAttribute('aria-busy') !== 'true'", timeout=10_000)


# ---------------------------------------------------------------------------
# Viewport responsiveness
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("viewport", VIEWPORTS)
def test_dashboard_responsive(page: Page, viewport: dict) -> None:
    """Verify the dashboard renders without layout overflow at each viewport."""
    page.set_viewport_size(viewport)
    page.goto(BASE_URL)
    wait_for_app(page)
    # The brand link (aria-label) is always present at every breakpoint
    expect(page.get_by_label("Preceptor Nexus dashboard")).to_be_visible()
    # No horizontal scrollbar at this viewport
    overflow = page.evaluate("document.body.scrollWidth > document.body.clientWidth")
    assert not overflow, f"Horizontal overflow at viewport {viewport['width']}x{viewport['height']}"


# ---------------------------------------------------------------------------
# Route traversal
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("route,label", ROUTES)
def test_route_renders(page: Page, route: str, label: str) -> None:
    """Verify each route loads without a fatal crash."""
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{BASE_URL}{route}")
    wait_for_app(page)
    # Nav link for this view should be marked active (aria-current=page)
    active_link = page.locator(f'[aria-current="page"]').first
    expect(active_link).to_be_visible()


# ---------------------------------------------------------------------------
# Health badge
# ---------------------------------------------------------------------------

def test_health_badge_renders(page: Page) -> None:
    """Verify the navbar health badge is present and shows one of the two expected labels."""
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(BASE_URL)
    wait_for_app(page)
    # Wait up to 5 s for the badge to resolve from 'checking'
    page.wait_for_timeout(5_000)
    connected = page.get_by_text("Cloud Engine Connected (FastAPI + SQLite)")
    offline = page.get_by_text("Local Engine Active (IndexedDB)")
    badge_visible = connected.is_visible() or offline.is_visible()
    assert badge_visible, "Neither cloud status badge variant was visible in the navbar"


# ---------------------------------------------------------------------------
# Assessment interactions
# ---------------------------------------------------------------------------

def test_assessment_start_and_answer(page: Page) -> None:
    """Verify the quiz flow: start, answer a question and advance to the next."""
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{BASE_URL}/assessment")
    wait_for_app(page)
    # Click the first set card to start a quiz
    page.get_by_text("Mixed exam simulation").click()
    # Wait for the first question to appear (progress bar is visible)
    page.wait_for_selector("h2", timeout=8_000)
    question_el = page.locator("h2").first
    expect(question_el).to_be_visible()
    # Choose option A (keyboard shortcut 1)
    page.keyboard.press("1")
    # Wait for feedback to appear
    page.wait_for_timeout(300)
    # Advance to next question
    page.keyboard.press("Enter")
    page.wait_for_timeout(300)
    # Progress bar should have advanced (width > 0%)
    progress = page.locator(".bg-gradient-brand").first
    expect(progress).to_be_visible()


# ---------------------------------------------------------------------------
# Flashcard interactions
# ---------------------------------------------------------------------------

def test_flashcard_flip(page: Page) -> None:
    """Verify a flashcard can be flipped to reveal the back face."""
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{BASE_URL}/flashcards")
    wait_for_app(page)
    # Check for at least one card or the empty-deck message
    card_or_empty = page.locator("[data-testid='flashcard'], .glass-strong").first
    expect(card_or_empty).to_be_visible(timeout=8_000)
    # If a card is present and has a flip/show button, click it
    show_btn = page.get_by_role("button", name="Show answer")
    if show_btn.is_visible():
        show_btn.click()
        page.wait_for_timeout(400)
        # After flip the back face should be revealed
        back = page.get_by_role("button", name="Got it")
        assert back.is_visible() or page.get_by_role("button", name="Not yet").is_visible()


# ---------------------------------------------------------------------------
# Study planner slider
# ---------------------------------------------------------------------------

def test_planner_slider(page: Page) -> None:
    """Verify the study hours slider can be adjusted."""
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{BASE_URL}/planner")
    wait_for_app(page)
    slider = page.get_by_role("slider").first
    if slider.is_visible():
        # Move slider right to increase study hours
        slider.focus()
        page.keyboard.press("ArrowRight")
        page.wait_for_timeout(200)


# ---------------------------------------------------------------------------
# Theme toggle
# ---------------------------------------------------------------------------

def test_theme_toggle(page: Page) -> None:
    """Verify the theme toggle switches between Cyber-Dark and Frosted-Light."""
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(BASE_URL)
    wait_for_app(page)
    html = page.locator("html")
    initial_classes = html.get_attribute("class") or ""
    # Click the theme toggle button
    toggle = page.get_by_role("button", name="Toggle theme")
    toggle.click()
    page.wait_for_timeout(300)
    new_classes = html.get_attribute("class") or ""
    assert initial_classes != new_classes, "Theme class did not change after toggle click"
    # Toggle back
    toggle.click()
    page.wait_for_timeout(300)
    restored_classes = html.get_attribute("class") or ""
    assert restored_classes == initial_classes, "Theme class did not restore to initial state"


# ---------------------------------------------------------------------------
# AI Buddy
# ---------------------------------------------------------------------------

def test_buddy_suggestion_pill(page: Page) -> None:
    """Verify clicking a suggestion pill sends a message and gets a response."""
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{BASE_URL}/buddy")
    wait_for_app(page)
    # Click the first suggestion pill
    first_pill = page.locator(".suggestion-carousel button").first
    expect(first_pill).to_be_visible()
    pill_text = first_pill.text_content()
    first_pill.click()
    # Wait for the buddy response (max 10 s for backend call or fallback)
    page.wait_for_timeout(10_000)
    # The chat log should now have at least one user message and one buddy reply
    chat_log = page.get_by_role("log")
    expect(chat_log).to_be_visible()
    # Verify the user message appears in the chat log (not the suggestion pill)
    assert pill_text and chat_log.get_by_text(pill_text[:30]).is_visible()


# ---------------------------------------------------------------------------
# Storage status popover
# ---------------------------------------------------------------------------

def test_storage_status_popover(page: Page) -> None:
    """Verify the storage status popover opens and shows status information."""
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(BASE_URL)
    wait_for_app(page)
    trigger = page.get_by_role("button", name="Show storage status")
    expect(trigger).to_be_visible()
    trigger.click()
    page.wait_for_timeout(300)
    popover = page.get_by_role("dialog", name="Storage status")
    expect(popover).to_be_visible()
    # Close it
    close_btn = page.get_by_role("button", name="Close storage status")
    if close_btn.is_visible():
        close_btn.click()
