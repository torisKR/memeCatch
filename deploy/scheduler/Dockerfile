FROM debian:bookworm-slim
ARG TARGETARCH
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* \
  && curl -fsSL -o /usr/local/bin/supercronic "https://github.com/aptible/supercronic/releases/download/v0.2.33/supercronic-linux-${TARGETARCH}" \
  && chmod +x /usr/local/bin/supercronic
COPY crontab /crontab
COPY run-cron /usr/local/bin/run-cron
RUN chmod 755 /usr/local/bin/run-cron
USER nobody
ENTRYPOINT ["/usr/local/bin/supercronic", "/crontab"]
