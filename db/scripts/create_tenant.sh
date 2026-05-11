#!/bin/bash
# Usage : ./db/scripts/create_tenant.sh client01 dev|staging|prod
set -e

TENANT=${1}
ENV=${2:-dev}
DB="samsecure_tenant_${TENANT}_${ENV}"

echo "Creation du tenant ${DB}"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DB};"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
  "GRANT ALL PRIVILEGES ON DATABASE ${DB} TO samsecure_api_rw;"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d ${DB} -c \
  "GRANT CONNECT ON DATABASE ${DB} TO pgadmin_viewer;"

$(dirname $0)/apply_tenant.sh ${TENANT} ${ENV}
echo "Tenant ${DB} cree et configure"
