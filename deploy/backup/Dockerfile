FROM postgres:16-bookworm
ARG TARGETARCH
RUN apt-get update \
  && apt-get install -y --no-install-recommends awscli ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* \
  && curl -fsSL -o /usr/local/bin/supercronic "https://github.com/aptible/supercronic/releases/download/v0.2.33/supercronic-linux-${TARGETARCH}" \
  && chmod +x /usr/local/bin/supercronic
COPY backup.sh restore.sh crontab /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh \
  && mv /usr/local/bin/crontab /crontab
ENTRYPOINT ["/usr/local/bin/supercronic", "/crontab"]
