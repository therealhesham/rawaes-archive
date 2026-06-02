
# ============================================
# Stage 1: Build frontend assets (Node.js)
# ============================================
FROM node:24-alpine AS node-builder

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY resources ./resources
COPY public ./public
COPY vite.config.js tailwind.config.js postcss.config.js ./

RUN npm run build

# ============================================
# Stage 2: Install PHP dependencies (Composer)
# ============================================
FROM composer:2 AS composer-builder

WORKDIR /app

COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --no-scripts \
    --no-autoloader \
    --prefer-dist \
    --no-interaction \
    --no-progress \
    --ignore-platform-reqs

COPY . .
RUN composer dump-autoload --optimize --no-dev --no-scripts

# ============================================
# Stage 3: Final production image
# ============================================
FROM php:8.4-fpm-alpine AS production

# Install system dependencies
RUN apk add --no-cache \
    nginx \
    supervisor \
    bash \
    curl \
    zip \
    unzip \
    git \
    icu-dev \
    libzip-dev \
    libxml2-dev \
    oniguruma-dev \
    postgresql-dev \
    mysql-client \
    netcat-openbsd \
    freetype-dev \
    libjpeg-turbo-dev \
    libpng-dev \
    imagemagick \
    imagemagick-dev \
    ghostscript \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-data-ara \
    tesseract-ocr-data-eng \
    $PHPIZE_DEPS

# Install PHP extensions
RUN docker-php-ext-configure intl \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
        pdo_mysql \
        bcmath \
        intl \
        zip \
        opcache \
        exif \
        pcntl \
        gd \
    && pecl install redis \
    && docker-php-ext-enable redis

# Cleanup
RUN apk del $PHPIZE_DEPS \
    && rm -rf /var/cache/apk/* /tmp/*

# Configure PHP
COPY docker/php/php.ini /usr/local/etc/php/conf.d/custom.ini
COPY docker/php/www.conf /usr/local/etc/php-fpm.d/www.conf

# Configure Nginx
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf

# Configure Supervisor
COPY docker/supervisor/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Copy entrypoint
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Set working directory
WORKDIR /var/www/html

# Copy application files
COPY --from=composer-builder --chown=www-data:www-data /app /var/www/html
COPY --from=node-builder --chown=www-data:www-data /app/public/build /var/www/html/public/build

# Permissions
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html/storage /var/www/html/bootstrap/cache

# Create log + nginx working directories with proper permissions
RUN mkdir -p /var/log/supervisor /var/log/nginx \
    /var/lib/nginx/tmp/client_body \
    /var/lib/nginx/tmp/proxy \
    /var/lib/nginx/tmp/fastcgi \
    /var/lib/nginx/tmp/uwsgi \
    /var/lib/nginx/tmp/scgi \
    && chown -R www-data:www-data /var/lib/nginx /var/log/nginx \
    && chmod -R 755 /var/lib/nginx \
    && touch /var/log/supervisor/supervisord.log

EXPOSE 80

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]