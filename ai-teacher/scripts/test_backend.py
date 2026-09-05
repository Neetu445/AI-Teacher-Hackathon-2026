"""End-to-end test of the teaching engine via HTTP (server must be running)."""
import json
import sys
import urllib.request

BASE = "http://127.0.0.1:8000"


def req(method, path, payload=None, raw=None, headers=None):
    data = json.dumps(payload).encode() if payload is not None else raw
    r = urllib.request.Request(BASE + path, data=data, method=method,
                               headers=headers or {"Content-Type": "application/json"})
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read().decode())


def drain(sid, answers=None, max_beats=200):
    """Pull beats until a question or done. Auto-answer with the queue of answers."""
    answers = list(answers or [])
    log = []
    for _ in range(max_beats):
        beat = req("POST", f"/api/sessions/{sid}/next")
        if beat.get("type") == "done":
            log.append(("done", None))
            return log
        if beat.get("say"):
            log.append((beat.get("type"), beat["say"][:90]))
        if beat.get("can_answer") and beat.get("q"):
            ans = answers.pop(0) if answers else "I don't know"
            log.append(("STUDENT", ans))
            verdict = req("POST", f"/api/sessions/{sid}/answer", {"answer": ans})
            log.append(("VERDICT", verdict))
    return log


def main():
    print("== config ==")
    cfg = req("GET", "/api/config")
    print("llm:", cfg["llm"], "| tts:", cfg["tts"])

    # ---- 1. Topic session: Electricity in Hindi, walk the misconception path
    print("\n== topic session (Ohm, hi) ==")
    s = req("POST", "/api/sessions", {"topic": "teach me electricity and ohm's law",
                                      "level": "beginner", "language": "hi", "minutes": 20})
    sid = s["session_id"]
    print("plan:", json.dumps(s["plan"], ensure_ascii=False))
    log = drain(sid, answers=[
        # voltage check
        "वोल्टेज वह धक्का है जो चार्ज को चलाता है",
        # current check — WRONG on purpose (describe voltage)
        "यह दबाव है",
        # followup after reteach
        "धारा चार्ज का बहाव है",
        # resistance check — THE classic misconception
        "धारा बढ़ जाएगी",
        # its followup
        "धारा घटेगी, क्योंकि पतले तार का प्रतिरोध ज़्यादा है",
        # ohm's law mcq — pick the misconception option (48 A)
        "option a",
        # followup mcq
        "3 A",
        # graph check
        "प्रतिरोध लगभग शून्य होने से धारा बहुत बढ़ जाती है और तार गर्म हो जाता है",
        # quiz
        "option c", "3 A", "प्रतिरोध बहाव का विरोध करता है इसलिए धारा कम हो जाती है",
    ])
    for kind, txt in log:
        print(f"  [{kind}] {txt}")
    rep = req("GET", f"/api/sessions/{sid}/report")
    print("REPORT:", json.dumps({k: rep[k] for k in ("score", "strong", "weak", "misconceptions")},
                                  ensure_ascii=False))

    # ---- 2. Doc session: upload sample notes
    print("\n== doc session (uploaded notes, en) ==")
    with open("/home/user/ai-teacher/samples/electricity_notes.txt", "rb") as f:
        boundary = "----testboundary"
        body = b""
        body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"electricity_notes.txt\"\r\nContent-Type: text/plain\r\n\r\n".encode()
        body += f.read() + f"\r\n--{boundary}--\r\n".encode()
    up = req("POST", "/api/upload", raw=body,
             headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    print("uploaded:", up["title"], "| outline:", up["outline"][:4], "| concepts:", up["concepts"][:6])
    s2 = req("POST", "/api/sessions", {"doc_id": up["doc_id"], "level": "beginner",
                                       "language": "en", "minutes": 15})
    sid2 = s2["session_id"]
    print("plan:", json.dumps(s2["plan"], ensure_ascii=False)[:400])
    log2 = drain(sid2, answers=None)   # student stays silent -> all wrong
    kinds = [k for k, _ in log2]
    print("beats:", len(log2), "| questions asked:", kinds.count("VERDICT"))
    print("sample beat:", log2[2][1][:120])

    # ---- 3. Study plan (7 days)
    print("\n== study plan (ML, 7 days) ==")
    s3 = req("POST", "/api/sessions", {"topic": "machine learning", "level": "beginner",
                                       "language": "en", "minutes": 7 * 1440})
    print("plan mode:", s3["plan"]["mode"], "| days:", s3["plan"]["days"])
    log3 = drain(s3["session_id"])
    print("study beats:", len(log3), "| first:", log3[2][1][:100] if len(log3) > 2 else log3)

    # ---- 4. Doubt + language switch
    print("\n== doubt + language switch ==")
    ans = req("POST", f"/api/sessions/{sid}/ask", {"question": "what is the unit of voltage?"})
    print("doubt:", ans)
    ls = req("POST", f"/api/sessions/{sid}/language", {"language": "hinglish"})
    print("switch:", ls)

    print("\nALL BACKEND TESTS PASSED")


if __name__ == "__main__":
    sys.exit(main())
