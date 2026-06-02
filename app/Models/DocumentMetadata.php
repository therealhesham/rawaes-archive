<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentMetadata extends Model
{
    protected $fillable = ['document_id', 'key', 'value', 'type'];

    public function document(): BelongsTo
    {
        return $this->belongsTo(ArchiveDocument::class, 'document_id');
    }
}
