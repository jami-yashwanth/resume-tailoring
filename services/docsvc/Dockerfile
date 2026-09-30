# docsvc — the file pipeline.
#
# Heavy on purpose: LibreOffice is what makes the page count real rather than
# estimated, and it does not fit in a serverless function — which is the whole
# reason this service exists separately from the Next.js app.
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

# Tectonic compiles the default template (app/latex_render.py). A pinned
# release tarball from the project's own GitHub releases, sha256-verified
# before unpacking — never the piped third-party installer this note used to
# warn about. Static musl build, so no TeX distribution enters the image; the
# ~100MB support bundle is fetched to TECTONIC_CACHE_DIR on first compile and
# any failure before then falls back to the drawn template.
ARG TECTONIC_VERSION=0.17.0
RUN set -eux; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
      amd64)  triple=x86_64-unknown-linux-musl; \
              sha256=8533d07f9ccbd7a65824b9e0459041bca34af1eb33daba48f59215593753a3b7 ;; \
      arm64)  triple=aarch64-unknown-linux-musl; \
              sha256=b10954a95404f3ab2328d2fa59a5ebab8e657f893fab096f98be8db7c0c979b8 ;; \
      *) echo "no pinned tectonic build for $arch" >&2; exit 1 ;; \
    esac; \
    curl -fsSL -o /tmp/tectonic.tar.gz \
      "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-${triple}.tar.gz"; \
    echo "${sha256}  /tmp/tectonic.tar.gz" | sha256sum -c -; \
    tar -xzf /tmp/tectonic.tar.gz -C /usr/local/bin tectonic; \
    rm /tmp/tectonic.tar.gz; \
    tectonic --version

WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN playwright install --with-deps chromium

COPY app ./app
COPY templates ./templates

# Bake tectonic's support bundle into the image by compiling the real template
# once at build time, through the same code the endpoint runs. Without this,
# every fresh container's first compile is a ~100MB fetch that blows past
# render_latex's timeout — so every fresh container would silently serve the
# drawn fallback instead of the template. Doubles as a build-time check that
# the LaTeX path works at all: a broken template fails the build, not the user.
ENV TECTONIC_CACHE_DIR=/opt/tectonic-cache
RUN mkdir -p "$TECTONIC_CACHE_DIR" && \
    python -c "from app.latex_render import render_latex; render_latex([{'kind': 'name', 'text': 'Warm Up'}], timeout=600)"

# 8001 is the same number BACKEND_PORT defaults to locally, so the container
# and a dev machine agree. A host that injects PORT still wins.
ENV SOFFICE_BIN=/usr/bin/soffice \
    PORT=8001
EXPOSE 8001

# One worker: each LibreOffice conversion already forks a process with its own
# profile, and the machine is sized for that, not for parallel Writer instances.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${BACKEND_PORT:-$PORT} --workers 1"]
