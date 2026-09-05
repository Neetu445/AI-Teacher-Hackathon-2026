"""Visual QA: drive the real UI headlessly, capture screenshots + console errors."""
import os, asyncio
from playwright.async_api import async_playwright

SHOTS = "/home/user/ai-teacher/scripts/shots"
os.makedirs(SHOTS, exist_ok=True)
URL = "http://127.0.0.1:8000/"
errors = []


async def wait_question(page, timeout=180_000):
    await page.wait_for_function(
        "document.getElementById('inputHint').textContent.includes('Your turn')",
        timeout=timeout)


async def answer(page, text):
    await page.fill("#answerInput", text)
    await page.click("#sendBtn")
    await page.wait_for_timeout(400)


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        page.on("pageerror", lambda e: errors.append(f"PAGEERROR: {e}"))
        page.on("console", lambda m: errors.append(f"CONSOLE-{m.type}: {m.text}") if m.type in ("error", "warning") else None)
        page.on("dialog", lambda d: asyncio.ensure_future(d.accept()))

        # ---- 1. setup screen
        await page.goto(URL, wait_until="networkidle")
        await page.wait_for_timeout(1200)
        await page.screenshot(path=f"{SHOTS}/01-setup.png")

        # ---- 2. topic tab -> Ohm, 20 min, English
        await page.click('button.tab[data-tab="topic"]')
        await page.click('.chip[data-topic="Electricity and Ohm\'s law"]')
        await page.click('.chip.time[data-min="20"]')
        await page.screenshot(path=f"{SHOTS}/02-setup-filled.png")
        await page.click("#startBtn")
        await page.wait_for_selector("#view-class:not(.hidden)", timeout=30_000)
        await page.wait_for_timeout(2500)
        await page.screenshot(path=f"{SHOTS}/03-class-greet.png")

        # ---- 3. walk the lesson
        await page.wait_for_function(                      # circuit board appears
            "document.querySelector('#chatLog').textContent.includes('water pressure in a pipe')",
            timeout=120_000)
        await page.screenshot(path=f"{SHOTS}/04-class-circuit.png")

        await wait_question(page)                          # voltage check
        await page.screenshot(path=f"{SHOTS}/05-question-open.png")
        await answer(page, "voltage is the electrical push or pressure")

        await wait_question(page)                          # current check
        await answer(page, "current is the flow of electric charge through a wire")

        await wait_question(page)                          # resistance check -> WRONG on purpose
        await answer(page, "the current increases")
        await page.wait_for_function(
            "document.querySelector('#chatLog').textContent.includes('misconception')",
            timeout=60_000)
        await page.wait_for_timeout(3500)                  # let the analogy beat render
        await page.screenshot(path=f"{SHOTS}/06-misconception.png")

        await wait_question(page)                          # followup question
        await answer(page, "current decreases because thinner wire has more resistance")

        await wait_question(page)                          # Ohm's law MCQ
        await page.wait_for_timeout(1500)
        await page.screenshot(path=f"{SHOTS}/07-mcq.png")
        mcqs = await page.query_selector_all(".mcq-opt")
        if mcqs:
            await mcqs[0].click()                          # 48 A -> misconception again
        await wait_question(page)                          # followup MCQ
        mcqs = await page.query_selector_all(".mcq-opt")
        if mcqs:
            await mcqs[0].click()                          # 3 A -> correct
        await page.wait_for_function(
            "document.querySelector('#chatLog').textContent.includes('short circuit')",
            timeout=120_000)
        await page.screenshot(path=f"{SHOTS}/08-graph.png")

        # ---- 4. end early -> report
        await page.click("#endBtn")
        await page.wait_for_selector("#view-report:not(.hidden)", timeout=30_000)
        await page.wait_for_timeout(1800)
        await page.screenshot(path=f"{SHOTS}/09-report.png", full_page=True)

        # ---- 5. Hindi session quick look
        await page.goto(URL, wait_until="networkidle")
        await page.click('button.tab[data-tab="topic"]')
        await page.click('.chip[data-topic="Electricity and Ohm\'s law"]')
        await page.select_option("#langSelect", "hi")
        await page.click('.chip.time[data-min="20"]')
        await page.click("#startBtn")
        await page.wait_for_selector("#view-class:not(.hidden)", timeout=30_000)
        await page.wait_for_function(
            "document.querySelector('#chatLog').textContent.includes('पानी के दबाव')",
            timeout=120_000)
        await page.wait_for_timeout(1500)
        await page.screenshot(path=f"{SHOTS}/10-hindi.png")

        # ---- profile drawer
        await page.click("#profileBtn")
        await page.wait_for_timeout(800)
        await page.screenshot(path=f"{SHOTS}/11-profile.png")

        await browser.close()
    print("shots saved:", sorted(os.listdir(SHOTS)))
    print("---- JS ERRORS/WARNINGS ----")
    print("\n".join(errors) if errors else "none 🎉")


asyncio.run(main())
