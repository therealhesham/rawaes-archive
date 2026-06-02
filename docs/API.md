# Rawaes Archive API (Integrations)

## Authentication

The API uses **Laravel Sanctum** personal access tokens.

Send the token as a Bearer token:

`Authorization: Bearer <TOKEN>`

The token user must have the permissions:
- `documents.create` (upload)
- `documents.download` (download)

## Option B (No user login): Shared integration token

If you want **zero manual setup for the 3rd-party developers** (no user accounts, no issuing tokens),
you can enable a shared integration token on the server:

- Set env var `INTEGRATION_API_TOKEN` (random long string).
- Optional: set `INTEGRATION_UPLOADER_USER_ID` (user id to attribute uploads to).

Then the external system sends:

`X-Integration-Token: <INTEGRATION_API_TOKEN>`

Endpoints:
- `GET /api/integration/bootstrap` (all metadata in one response)
- `GET /api/integration/sectors`
- `GET /api/integration/document-types`
- `GET /api/integration/folders?sector_id=...`
- `POST /api/integration/documents` (multipart upload)

Example `curl` bootstrap:
```bash
curl "http://45.63.117.248/api/integration/bootstrap" \
  -H "X-Integration-Token: INTEGRATION_TOKEN_HERE" \
  -H "Accept: application/json"
```

Example `curl` upload:
```bash
curl -X POST "http://45.63.117.248/api/integration/documents" \
  -H "X-Integration-Token: INTEGRATION_TOKEN_HERE" \
  -H "Accept: application/json" \
  -F "file=@/path/to/file.pdf" \
  -F "sector_id=1" \
  -F "folder_id=10" \
  -F "document_type_id=3" \
  -F "title=عقد إيجار" \
  -F "source_device=ExternalSystem01"
```

## Upload a document

`POST /api/documents`

**Content-Type:** `multipart/form-data`

Fields:
- `file` (required) — one file
- `sector_id` (required)
- `folder_id` (required)
- `document_type_id` (required)
- `title` (optional)
- `document_number` (optional)
- `issuing_entity` (optional)
- `issue_date` (optional, `YYYY-MM-DD`)
- `expiry_date` (optional, `YYYY-MM-DD`)
- `notes` (optional)
- `is_confidential` (optional, boolean)

Example `curl`:
```bash
curl -X POST "http://45.63.117.248/api/documents" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: application/json" \
  -F "file=@/path/to/file.pdf" \
  -F "sector_id=1" \
  -F "folder_id=10" \
  -F "document_type_id=3" \
  -F "title=عقد إيجار" \
  -F "document_number=ABC-123"
```

Response:
```json
{
  "success": true,
  "id": 123,
  "serial_number": 45,
  "title": "عقد إيجار",
  "url": "http://45.63.117.248/archive/documents/123"
}
```

## Download a document

`GET /api/documents/{id}/download`

Example:
```bash
curl -L "http://45.63.117.248/api/documents/123/download" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o document.pdf
```
