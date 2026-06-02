<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryAuditItem extends Model
{
    protected $fillable = [
        'audit_id',
        'physical_folder_id',
        'expected_code',
        'status',
        'scanned_by',
        'scanned_at',
        'notes',
    ];

    protected $casts = [
        'scanned_at' => 'datetime',
    ];

    public function audit(): BelongsTo
    {
        return $this->belongsTo(InventoryAudit::class, 'audit_id');
    }

    public function physicalFolder(): BelongsTo
    {
        return $this->belongsTo(PhysicalFolder::class, 'physical_folder_id');
    }

    public function scanner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'scanned_by');
    }
}

