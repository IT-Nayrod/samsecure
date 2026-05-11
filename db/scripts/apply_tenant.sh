#!/bin/bash
# Usage : ./db/scripts/apply_tenant.sh client01 dev|staging|prod
set -e

TENANT=${1}
ENV=${2:-dev}
DB="samsecure_tenant_${TENANT}_${ENV}"
DIR="$(cd $(dirname $0)/../tenant/migrations && pwd)"

echo "[Tenant ${TENANT}] Migrations sur ${DB}"

for file in $(ls ${DIR}/*.sql | sort); do
  ver=$(basename $file .sql | cut -d'_' -f1)
  already=$(sudo -u postgres psql -d ${DB} -tAc \
    "SELECT count(*) FROM schema_migrations WHERE version='${ver}'" 2>/dev/null || echo 0)
  if [ "$already" = "0" ]; then
    echo "  -> Migration ${ver}"
    sudo -u postgres psql -d ${DB} -f $file
  else
    echo "  -- ${ver} deja appliquee"
  fi
done

echo "[Tenant ${TENANT}] Termine"
