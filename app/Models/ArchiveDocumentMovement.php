<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ArchiveDocumentMovement extends Model
{
    protected $fillable = [
        'document_id',
        'action',
        'to_person',
        'notes',
        'signature_path',
        'created_by',
    ];

    public function document(): BelongsTo
    {
        return $this->belongsTo(ArchiveDocument::class, 'document_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
