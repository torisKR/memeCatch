FROM debian:bookworm-slim
ARG TARGETARCH
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* \
  && arch="${TARGETARCH:-$(dpkg --print-architecture)}" \
  && case "$arch" in aarch64) arch=arm64 ;; x86_64) arch=amd64 ;; esac \
  && case "$arch" in \
       amd64) supercronic_sha=feefa310da569c81b99e1027b86b27b51e6ee9ab647747b49099645120cfc671 ;; \
       arm64) supercronic_sha=f1f8585c66de020fef494dd636058f99949d108f569fef00016a1c8b9eb145b3 ;; \
       *) echo "unsupported arch ${arch}" >&2; exit 1 ;; \
     esac \
  && curl -fsSL -o /usr/local/bin/supercronic "https://github.com/aptible/supercronic/releases/download/v0.2.33/supercronic-linux-${arch}" \
  && echo "${supercronic_sha}  /usr/local/bin/supercronic" | sha256sum -c - \
  && chmod +x /usr/local/bin/supercronic
COPY crontab /crontab
COPY run-cron /usr/local/bin/run-cron
RUN chmod 755 /usr/local/bin/run-cron
USER nobody
ENTRYPOINT ["/usr/local/bin/supercronic", "/crontab"]
