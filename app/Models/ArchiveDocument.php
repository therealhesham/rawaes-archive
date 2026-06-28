<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class ArchiveDocument extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'serial_number',
        'title', 'document_number', 'folder_id', 'document_type_id', 'sector_id',
        'uploaded_by', 'upload_source', 'file_path', 'file_name', 'file_extension', 'file_size',
        'mime_type', 'issuing_entity', 'issue_date', 'expiry_date', 'no_expiry_date', 'physical_location',
        'qr_code', 'barcode', 'ocr_content', 'tags', 'notes', 'status', 'is_confidential',
        'is_checked_out', 'checked_out_to', 'checked_out_by', 'checked_out_at', 'checked_out_notes',
    ];

    protected $casts = [
        'tags' => 'array',
        'issue_date' => 'date:Y-m-d',
        'expiry_date' => 'date:Y-m-d',
        'no_expiry_date' => 'boolean',
        'is_confidential' => 'boolean',
        'is_checked_out' => 'boolean',
        'checked_out_at' => 'datetime',
        'expiry_notified_at' => 'datetime',
    ];

    protected $appends = ['is_expired', 'is_expiring_soon', 'file_size_formatted'];

    protected static function booted(): void
    {
        static::creating(function (self $doc) {
            if (!empty($doc->serial_number)) {
                return;
            }

            $max = (int) DB::table('archive_documents')->max('serial_number');
            $doc->serial_number = $max + 1;
        });
    }

    public function folder(): BelongsTo
    {
        return $this->belongsTo(DocumentFolder::class);
    }

    public function documentType(): BelongsTo
    {
        return $this->belongsTo(DocumentType::class);
    }

    public function sector(): BelongsTo
    {
        return $this->belongsTo(Sector::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function metadata(): HasMany
    {
        return $this->hasMany(DocumentMetadata::class, 'document_id');
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class, 'auditable_id')
            ->where('auditable_type', self::class);
    }

    public function scopeSearch(Builder $query, string $term): Builder
    {
        return $query->where(function ($q) use ($term) {
            $q->where('title', 'like', "%{$term}%")
              ->orWhere('document_number', 'like', "%{$term}%")
              ->orWhere('issuing_entity', 'like', "%{$term}%")
              ->orWhere('ocr_content', 'like', "%{$term}%")
              ->orWhere('notes', 'like', "%{$term}%");
        });
    }

    public function scopeExpiringSoon(Builder $query, int $days = 30): Builder
    {
        return $query->whereBetween('expiry_date', [now(), now()->addDays($days)]);
    }

    public function scopeExpired(Builder $query): Builder
    {
        return $query->where('expiry_date', '<', now());
    }

    public function getFileSizeFormattedAttribute(): string
    {
        $bytes = $this->file_size;
        if ($bytes >= 1048576) return round($bytes / 1048576, 2) . ' MB';
        if ($bytes >= 1024) return round($bytes / 1024, 2) . ' KB';
        return $bytes . ' B';
    }

    public function getIsExpiredAttribute(): bool
    {
        return $this->expiry_date && $this->expiry_date->isPast();
    }

    public function getIsExpiringSoonAttribute(): bool
    {
        return $this->expiry_date &&
               $this->expiry_date->isFuture() &&
               $this->expiry_date->diffInDays(now()) <= 30;
    }
}