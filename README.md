# Rawaes Archive

Rawaes Archive is a document archiving and records management platform built for organizations that need a practical Arabic-first workflow for digital documents, scanned files, physical archive inventory, custody tracking, reporting, and controlled access.

The project combines a web application, scanner integration, OCR processing, audit logging, and integration APIs in a single deployable system.

## Overview

Rawaes Archive helps teams:

- archive electronic and scanned documents in a structured folder tree
- classify records by sector, folder, and document type
- manage confidential files with role-based access control
- track custody handover and return for documents and physical archive folders
- perform physical inventory audits using QR / barcode scanning
- monitor document expiry and recent activity from a central dashboard
- receive uploads from external systems through an integration API

## Core Features

### Document Management

- Multi-file upload for electronic documents
- Support for scanned documents and scanner-origin uploads
- Document metadata: title, serial number, document number, issuing entity, issue date, expiry date, notes
- QR code and barcode generation per document
- Document preview, download, email, OCR, and audit trace
- Soft delete with trash, restore, and permanent delete flows

### Classification and Access Control

- Sector-based archive structure
- Nested folder management
- Configurable document types
- Role and permission management using fine-grained access rules
- Confidential document visibility rules

### Custody and Return Tracking

- Document custody checkout / checkin
- Physical folder custody checkout / checkin
- Signature capture for custody actions
- Dashboard visibility for documents that have not yet been returned
- History of custody movements with detailed audit logs

### Physical Archive Inventory

- Physical folder registry with inventory code and QR code
- Lookup by code or scan
- Full inventory audit sessions
- Status-based audit workflow: pending, found, missing
- Manual status actions and automatic missing classification at audit close
- Visibility of checked-out folders during audit results

### Scanning and OCR

- Browser-based scan flow from the web app
- Desktop scanner bridge in `scanner-watcher/`
- Batch / ADF scanning workflow with PDF generation
- OCR processing through configured OCR provider
- Scan inbox for review, assignment, and archive insertion

### Reporting and Auditability

- Dashboard statistics and recent activity
- Expiry alerts and filtered reporting
- Arabic audit log with incoming / outgoing activity views
- Exportable report endpoints and CSV output for inventory audit results

### Integration API

- API upload endpoints for third-party systems
- Shared integration token workflow for zero-login integrations
- Bootstrap metadata endpoint for sectors, folders, and document types
- Download endpoint for integrated document retrieval

See [docs/API.md](docs/API.md) for integration details.

## Tech Stack

### Backend

- PHP 8.3+
- Laravel 13
- Laravel Sanctum
- Laravel Queues
- Spatie Laravel Permission
- Spatie Media Library
- Intervention Image
- PhpSpreadsheet
- PHPWord

### Frontend

- React
- Inertia.js
- Vite
- Tailwind CSS
- Headless UI
- Lucide React
- Axios
- Recharts
- ZXing browser libraries for scanning workflows

### Infrastructure

- Docker / Docker Compose
- MySQL 8
- Redis 7
- Nginx
- Supervisor

### Desktop Scanner Companion

The repository includes a Windows desktop scanner bridge under [scanner-watcher](scanner-watcher) for environments that use local scanners and ADF workflows.

## Architecture Summary

The production setup is containerized and includes:

- `app`: Laravel application with PHP-FPM, Nginx, queue runtime, and app services
- `mysql`: primary relational database
- `redis`: cache, session, and queue backend
- `scanner-watcher/`: optional local desktop bridge for scanner-connected workstations

## Deployment

The project ships with Docker-based deployment via [docker-compose.yaml](docker-compose.yaml).

### Main services

- Web app on port `80`
- MySQL for persistent data
- Redis for queues, cache, and sessions
- Persistent Docker volumes for database and application storage

### Required environment values

Important environment variables include:

- `APP_URL`
- `APP_KEY`
- `MYSQL_ROOT_PASSWORD`
- `MYSQL_PASSWORD`
- `REDIS_PASSWORD`
- `OCR_SPACE_API_KEY`
- `SCAN_API_TOKEN`
- `INTEGRATION_API_TOKEN`
- `MAIL_*`

## Quick Start

### Local setup

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --force
npm install
npm run build
php artisan serve
```

### Docker setup

```bash
cp .env.example .env
docker compose -f docker-compose.yaml build --no-cache
docker compose -f docker-compose.yaml up -d
docker compose -f docker-compose.yaml exec app php artisan migrate --force
```

## Application Areas

Important routes and modules include:

- `/dashboard` - executive and operational dashboard
- `/archive/documents` - document archive
- `/archive/scans` - scan inbox
- `/archive/inventory` - physical archive inventory and audits
- `/archive/audit-logs` - audit trail
- `/reports` - filtered reporting
- `/roles` - roles and permissions

## Project Structure

```text
app/                 Laravel application logic
resources/js/        React + Inertia frontend
routes/              Web and API route definitions
database/            Migrations and seeders
docker/              Container runtime configuration
docs/                Project-specific documentation
scanner-watcher/     Desktop scanner bridge and installer scripts
```

## Security Model

The system uses:

- authenticated web access
- role-based permissions
- sector-scoped access rules
- audit logging for sensitive actions
- integration token or Sanctum token access for API consumers

## Integration Notes

Third-party systems can upload directly into the archive through API endpoints and shared integration tokens. This is designed for ERP systems, external scanners, or internal line-of-business apps that need to archive documents automatically.

See [docs/API.md](docs/API.md).

## License

This repository is currently maintained as a private business application unless a different license is explicitly added later.
