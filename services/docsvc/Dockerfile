# docsvc — the file pipeline.
#
# Heavy on purpose: LibreOffice is what makes the page count real rather than
# estimated, and Tectonic is what compiles a LaTeX resume. Neither fits in a
# serverless function, which is the whole reason this service exists separately
# from the Next.js app.
FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOME=/tmp

# libreoffice-writer, not the full suite: same Writer layout engine, much smaller
# image. The font packages are the metric-compatible stand-ins a resume needs so
# that a document written in Calibri or Cambria still lays out at the right width
# (docs/05-architecture.md — "server font library").
RUN apt-get update && apt-get install -y --no-install-recommends \
      libreoffice-writer \
      libreoffice-core \
      default-jre-headless \
      fonts-liberation \
      fonts-crosextra-carlito \
      fonts-crosextra-caladea \
      fonts-dejavu \
      fonts-noto-core \
      curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Tectonic for the LaTeX path. Self-contained binary, no TeX Live tree.
RUN curl -fsSL https://drop-sh.fullyjustified.net | sh -s -- --dest /usr/local/bin \
    && chmod +x /usr/local/bin/tectonic

WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

ENV SOFFICE_BIN=/usr/bin/soffice \
    PORT=8000
EXPOSE 8000

# One worker: each LibreOffice conversion already forks a process with its own
# profile, and the machine is sized for that, not for parallel Writer instances.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1"]
