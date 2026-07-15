#!/bin/sh
set -e

cd /var/www/html

echo "🚀 Starting روائس Archive System..."

# Build .env from environment variables on every boot
# (this guarantees Laravel sees the latest values even after config:cache)
echo "📝 Writing .env from environment..."
ENV_VARS="APP_NAME APP_ENV APP_KEY APP_DEBUG APP_URL APP_TIMEZONE APP_LOCALE \
LOG_CHANNEL LOG_LEVEL \
DB_CONNECTION DB_HOST DB_PORT DB_DATABASE DB_USERNAME DB_PASSWORD \
REDIS_HOST REDIS_PORT REDIS_PASSWORD REDIS_CLIENT \
CACHE_STORE SESSION_DRIVER SESSION_LIFETIME SESSION_DOMAIN SESSION_SECURE_COOKIE SESSION_SAME_SITE QUEUE_CONNECTION \
FILESYSTEM_DISK \
OCR_SPACE_API_KEY \
SCAN_API_TOKEN \
INTEGRATION_API_TOKEN INTEGRATION_UPLOADER_USER_ID \
MAIL_MAILER MAIL_HOST MAIL_PORT MAIL_USERNAME MAIL_PASSWORD MAIL_ENCRYPTION MAIL_FROM_ADDRESS MAIL_FROM_NAME \
BCRYPT_ROUNDS \
OPENROUTER_API_KEY OPENROUTER_MODEL OPENROUTER_BASE_URL OPENROUTER_MAX_PAGES OPENROUTER_DPI \
ARCHIVE_DISK DO_SPACES_KEY DO_SPACES_SECRET DO_SPACES_REGION DO_SPACES_BUCKET DO_SPACES_ENDPOINT"

> .env
for var in $ENV_VARS; do
    val=$(printenv "$var" || true)
    if [ -n "$val" ]; then
        echo "$var=$val" >> .env
    fi
done

# Wait for database
if [ -n "$DB_HOST" ]; then
    echo "⏳ Waiting for database at $DB_HOST..."
    timeout=60
    while ! nc -z "$DB_HOST" "${DB_PORT:-3306}" 2>/dev/null; do
        timeout=$((timeout - 1))
        if [ $timeout -le 0 ]; then
            echo "⚠️ Database not reachable after 60s, continuing anyway..."
            break
        fi
        sleep 1
    done
    echo "✅ Database reachable"
fi

# Generate app key only if missing
if [ -z "$APP_KEY" ] || [ "$APP_KEY" = "base64:" ]; then
    echo "🔑 Generating APP_KEY..."
    APP_KEY=$(php -r "echo 'base64:'.base64_encode(random_bytes(32));")
    export APP_KEY
    echo "APP_KEY=$APP_KEY" >> .env
    echo "⚠️ Generated APP_KEY — add it to Coolify env vars: $APP_KEY"
fi

# Run migrations
echo "📦 Running migrations..."
php artisan migrate --force 2>&1 || echo "⚠️ Migration failed (will retry on next boot)"

# Seed if database is empty
USER_COUNT=$(php artisan tinker --execute="echo App\Models\User::count();" 2>/dev/null | tail -1 || echo "0")
if [ "$USER_COUNT" = "0" ]; then
    echo "🌱 Seeding initial data..."
    php artisan db:seed --class=RawaesSeeder --force 2>&1 || echo "⚠️ Seeding skipped"
fi

# Storage link
php artisan storage:link 2>/dev/null || true

# Cache config/routes/views for production
echo "⚡ Optimizing..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Permissions
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache
chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

echo "✅ Ready!"

exec "$@"
