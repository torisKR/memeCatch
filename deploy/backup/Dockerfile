FROM postgres:16-bookworm
ARG TARGETARCH
RUN apt-get update \
  && apt-get install -y --no-install-recommends awscli ca-certificates curl python3 \
  && rm -rf /var/lib/apt/lists/* \
  && arch="${TARGETARCH:-$(dpkg --print-architecture)}" \
  && case "$arch" in aarch64) arch=arm64 ;; x86_64) arch=amd64 ;; esac \
  && curl -fsSL -o /usr/local/bin/supercronic "https://github.com/aptible/supercronic/releases/download/v0.2.33/supercronic-linux-${arch}" \
  && curl -fsSL -o /tmp/age.tar.gz "https://github.com/FiloSottile/age/releases/download/v1.2.1/age-v1.2.1-linux-${arch}.tar.gz" \
  && tar -C /tmp -xzf /tmp/age.tar.gz \
  && mv /tmp/age/age /tmp/age/age-keygen /usr/local/bin/ \
  && rm -rf /tmp/age /tmp/age.tar.gz \
  && chmod +x /usr/local/bin/supercronic /usr/local/bin/age /usr/local/bin/age-keygen
COPY deploy/postgres/pg-env.sh deploy/backup/backup.sh deploy/backup/restore.sh /usr/local/bin/
COPY deploy/backup/crontab /crontab
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/pg-env.sh
ENTRYPOINT ["/usr/local/bin/supercronic", "/crontab"]
