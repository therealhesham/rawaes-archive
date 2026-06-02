<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DocumentType extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name', 'name_en', 'code', 'default_folder_id',
        'required_metadata', 'requires_expiry', 'is_active',
    ];

    protected $casts = [
        'required_metadata' => 'array',
        'requires_expiry' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function defaultFolder(): BelongsTo
    {
        return $this->belongsTo(DocumentFolder::class, 'default_folder_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(ArchiveDocument::class);
    }
}
