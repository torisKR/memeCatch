FROM postgres:16-bookworm
ARG TARGETARCH
RUN apt-get update \
  && apt-get install -y --no-install-recommends awscli ca-certificates curl python3 \
  && rm -rf /var/lib/apt/lists/* \
  && arch="${TARGETARCH:-$(dpkg --print-architecture)}" \
  && case "$arch" in aarch64) arch=arm64 ;; x86_64) arch=amd64 ;; esac \
  && case "$arch" in \
       amd64) supercronic_sha=feefa310da569c81b99e1027b86b27b51e6ee9ab647747b49099645120cfc671; age_sha=7df45a6cc87d4da11cc03a539a7470c15b1041ab2b396af088fe9990f7c79d50 ;; \
       arm64) supercronic_sha=f1f8585c66de020fef494dd636058f99949d108f569fef00016a1c8b9eb145b3; age_sha=57fd79a7ece5fe501f351b9dd51a82fbee1ea8db65a8839db17f5c080245e99f ;; \
       *) echo "unsupported arch ${arch}" >&2; exit 1 ;; \
     esac \
  && curl -fsSL -o /usr/local/bin/supercronic "https://github.com/aptible/supercronic/releases/download/v0.2.33/supercronic-linux-${arch}" \
  && echo "${supercronic_sha}  /usr/local/bin/supercronic" | sha256sum -c - \
  && curl -fsSL -o /tmp/age.tar.gz "https://github.com/FiloSottile/age/releases/download/v1.2.1/age-v1.2.1-linux-${arch}.tar.gz" \
  && echo "${age_sha}  /tmp/age.tar.gz" | sha256sum -c - \
  && tar -C /tmp -xzf /tmp/age.tar.gz \
  && mv /tmp/age/age /tmp/age/age-keygen /usr/local/bin/ \
  && rm -rf /tmp/age /tmp/age.tar.gz \
  && chmod +x /usr/local/bin/supercronic /usr/local/bin/age /usr/local/bin/age-keygen
COPY deploy/postgres/pg-env.sh deploy/backup/backup.sh deploy/backup/restore.sh deploy/backup/test-restore.sh /usr/local/bin/
COPY deploy/backup/crontab /crontab
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/test-restore.sh /usr/local/bin/pg-env.sh
ENTRYPOINT ["/usr/local/bin/supercronic", "/crontab"]
