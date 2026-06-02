<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PendingScan extends Model
{
    protected $fillable = [
        'original_name', 'file_path', 'file_extension', 'file_size', 'mime_type',
        'source', 'source_device', 'thumbnail', 'status',
        'assigned_to_document_id', 'claimed_by', 'claimed_at',
    ];

    protected $casts = [
        'claimed_at' => 'datetime',
    ];

    public function assignedDocument(): BelongsTo
    {
        return $this->belongsTo(ArchiveDocument::class, 'assigned_to_document_id');
    }

    public function claimer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'claimed_by');
    }

    public function getFileSizeFormattedAttribute(): string
    {
        $b = $this->file_size;
        if ($b >= 1048576) return round($b / 1048576, 1) . ' MB';
        if ($b >= 1024) return round($b / 1024, 1) . ' KB';
        return $b . ' B';
    }
}
