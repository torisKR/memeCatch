# Drop settings a Postgres 17 dump emits that Postgres 16 rejects, and drop
# transaction wrappers so the caller can keep one transaction around the load.
# Lines inside COPY data are left unchanged.
BEGIN { copy = 0 }
/^COPY / { copy = 1 }
/^\\\.$/ { copy = 0 }
copy == 0 && tolower($0) ~ /^[[:space:]]*set[[:space:]]+transaction_timeout[[:space:]]*(=|to)/ { next }
copy == 0 && tolower($0) ~ /set_config\('transaction_timeout'/ { next }
copy == 0 && tolower($0) ~ /^[[:space:]]*set[[:space:]]+session_replication_role[[:space:]]/ { next }
copy == 0 && $0 ~ /^\\restrict/ { next }
copy == 0 && $0 ~ /^\\unrestrict/ { next }
copy == 0 && tolower($0) ~ /^[[:space:]]*(begin|commit);[[:space:]]*$/ { next }
{ print }
