#!/bin/sh
# Inject runtime environment variables into the compiled JS assets.
# The build produces a placeholder string "__VITE_API_URL__" which is
# replaced here with the actual value from the container environment.

API_URL="${VITE_API_URL:-/api/v1}"

echo "Injecting VITE_API_URL=${API_URL} into frontend assets..."

find /usr/share/nginx/html/assets -name "*.js" -exec \
  sed -i "s|__VITE_API_URL__|${API_URL}|g" {} +

echo "Environment injection complete."
