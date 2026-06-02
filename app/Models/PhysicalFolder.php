<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class PhysicalFolder extends Model
{
    protected $fillable = [
        'sector_id',
        'document_folder_id',
        'name',
        'description',
        'location',
        'inventory_code',
        'qr_code',
        'is_active',
        'is_checked_out',
        'checked_out_to',
        'checked_out_by',
        'checked_out_at',
        'checked_out_notes',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_checked_out' => 'boolean',
        'checked_out_at' => 'datetime',
    ];

    public static function generateInventoryCode(): string
    {
        for ($i = 0; $i < 12; $i++) {
            $candidate = Str::upper(Str::random(8));
            if (!static::where('inventory_code', $candidate)->exists()) {
                return $candidate;
            }
        }
        return (string) Str::uuid();
    }

    protected static function booted(): void
    {
        static::creating(function (self $folder) {
            if (!$folder->inventory_code) $folder->inventory_code = static::generateInventoryCode();
            if (!$folder->qr_code) $folder->qr_code = $folder->inventory_code;
        });
    }

    public function sector(): BelongsTo
    {
        return $this->belongsTo(Sector::class);
    }

    public function documentFolder(): BelongsTo
    {
        return $this->belongsTo(DocumentFolder::class, 'document_folder_id');
    }

    public function movements(): HasMany
    {
        return $this->hasMany(PhysicalFolderMovement::class, 'physical_folder_id')->latest();
    }
}

