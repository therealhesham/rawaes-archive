<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryAudit extends Model
{
    protected $fillable = [
        'title',
        'status',
        'started_by',
        'started_at',
        'ended_by',
        'ended_at',
        'notes',
        'result',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
        'result' => 'array',
    ];

    public function starter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'started_by');
    }

    public function ender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'ended_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(InventoryAuditItem::class, 'audit_id');
    }
}

