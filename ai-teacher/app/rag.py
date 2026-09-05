"""Lightweight RAG: chunking + TF-IDF retrieval (no external services needed).

If an LLM is configured, retrieved chunks are injected into planner / doubt /
evaluation prompts as grounding context. Without an LLM, the same retriever
grounds the offline teaching engine, so explanations and answers always come
from the uploaded material.
"""
import math
import re
from collections import Counter

_STOP = set("""the a an and or of to in is are was were for on with as by at from that this it its
be been has have had not but they we you he she i their his her our your my which who whom what when
where why how can could will would shall should may might do does did so such than then there here
into over under between about through during before after above below up down out off again further
once only very just also each other some any no nor own same both few more most s t""".split())

_WORD = re.compile(r"[a-zA-Z\u0900-\u097F][a-zA-Z0-9\u0900-\u097F'-]*")


def tokenize(text):
    return [t for t in (w.lower() for w in _WORD.findall(text)) if t not in _STOP and len(t) > 2]


def chunk_text(text, size=700, overlap=120):
    """Split text into overlapping chunks, respecting paragraph boundaries,
    carrying the nearest heading along as context prefix."""
    lines = text.splitlines()
    blocks, current, heading = [], [], ""
    for line in lines:
        stripped = line.strip()
        if stripped and (stripped.startswith("#") or re.match(r"^(\d+(\.\d+)*[.)]\s+|chapter\s+\d+|unit\s+\d+)",
                                                              stripped, re.I)) and len(stripped) < 120:
            heading = stripped.lstrip("#").strip()
        if not stripped:
            if current:
                blocks.append((heading, " ".join(current)))
                current = []
        else:
            current.append(stripped)
    if current:
        blocks.append((heading, " ".join(current)))

    chunks, buff, buff_head = [], "", ""
    for head, para in blocks:
        candidate = (buff + " " + para).strip()
        if len(candidate) < size:
            buff, buff_head = candidate, buff_head or head
        else:
            if buff:
                chunks.append(_mk(buff, buff_head))
            buff, buff_head = para, head
            while len(buff) > size:
                chunks.append(_mk(buff[:size], buff_head))
                buff = buff[size - overlap:]
    if buff and len(buff) > 40:
        chunks.append(_mk(buff, buff_head))
    return chunks


def _mk(text, heading):
    return {"heading": heading, "text": (heading + ": " + text) if heading else text}


class Retriever:
    def __init__(self, chunks):
        self.chunks = chunks
        self.doc_tokens = [tokenize(c["text"]) for c in chunks]
        self.df = Counter()
        for toks in self.doc_tokens:
            for t in set(toks):
                self.df[t] += 1
        self.n = max(1, len(chunks))
        self.tfidf = [self._vectorize(toks) for toks in self.doc_tokens]

    def _idf(self, term):
        return math.log((1 + self.n) / (1 + self.df.get(term, 0))) + 1.0

    def _vectorize(self, toks):
        counts = Counter(toks)
        vec = {t: (1 + math.log(c)) * self._idf(t) for t, c in counts.items()}
        norm = math.sqrt(sum(v * v for v in vec.values())) or 1.0
        return {t: v / norm for t, v in vec.items()}

    def search(self, query, k=4):
        qv = self._vectorize(tokenize(query))
        scores = []
        for idx, dv in enumerate(self.tfidf):
            score = sum(w * dv.get(t, 0.0) for t, w in qv.items())
            if score > 0.01:
                scores.append((score, idx))
        scores.sort(reverse=True)
        return [(self.chunks[i]["text"], round(s, 3)) for s, i in scores[:k]]


def extract_concepts(text, top_n=12):
    """Heuristic key-concept extraction (unigrams + bigrams by frequency)."""
    toks = tokenize(text)
    uni = Counter(toks)
    grams = Counter()
    word_seq = [w.lower() for w in _WORD.findall(text)]
    for a, b in zip(word_seq, word_seq[1:]):
        if a not in _STOP and b not in _STOP and len(a) > 2 and len(b) > 2:
            grams[(a, b)] += 1
    items = [(" ".join(g), c * 2) for g, c in grams.most_common(top_n) if c > 1]
    items += [(w, c) for w, c in uni.most_common(top_n)]
    items.sort(key=lambda x: -x[1])
    seen, out = set(), []
    for w, _ in items:
        if w not in seen:
            seen.add(w)
            out.append(w)
        if len(out) >= top_n:
            break
    return out
