<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentFolderMovement extends Model
{
    protected $fillable = [
        'folder_id',
        'action',
        'to_person',
        'notes',
        'created_by',
    ];

    public function folder(): BelongsTo
    {
        return $this->belongsTo(DocumentFolder::class, 'folder_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

