#!/bin/bash
# Usage : ./db/scripts/apply_common.sh dev|staging|prod
set -e

ENV=${1:-dev}
DB="samsecure_common_${ENV}"
DIR="$(cd $(dirname $0)/../common/migrations && pwd)"

echo "[Common] Migrations sur ${DB}"

for file in $(ls ${DIR}/*.sql | sort); do
  ver=$(basename $file .sql | cut -d'_' -f1)
  already=$(sudo -u postgres psql -d ${DB} -tAc \
    "SELECT count(*) FROM schema_migrations WHERE version='${ver}'" 2>/dev/null || echo 0)
  if [ "$already" = "0" ]; then
    echo "  -> Migration ${ver}"
    sudo -u postgres psql -v ON_ERROR_STOP=1 -d ${DB} -f $file
  else
    echo "  -- ${ver} deja appliquee"
  fi
done

echo "[Common] Termine"
