<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PhysicalFolderMovement extends Model
{
    protected $fillable = [
        'physical_folder_id',
        'action',
        'to_person',
        'notes',
        'signature_path',
        'created_by',
    ];

    public function physicalFolder(): BelongsTo
    {
        return $this->belongsTo(PhysicalFolder::class, 'physical_folder_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
