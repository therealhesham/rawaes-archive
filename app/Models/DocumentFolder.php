<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class DocumentFolder extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'sector_id',
        'parent_id',
        'name',
        'name_en',
        'qr_code',
        'inventory_code',
        'is_checked_out',
        'checked_out_to',
        'checked_out_by',
        'checked_out_at',
        'checked_out_notes',
        'description',
        'icon',
        'color',
        'sort_order',
        'is_active',
    ];

    protected $casts = ['is_active' => 'boolean'];

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
            if (!$folder->inventory_code)
                $folder->inventory_code = static::generateInventoryCode();
            if (!$folder->qr_code)
                $folder->qr_code = $folder->inventory_code; // default QR value = short code
        });
    }

    public function sector(): BelongsTo
    {
        return $this->belongsTo(Sector::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(DocumentFolder::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(DocumentFolder::class, 'parent_id')
            ->orderBy('sort_order')
            ->withCount('documents')
            ->withSum('documents as documents_size', 'file_size')
            ->with('children');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(ArchiveDocument::class, 'folder_id');
    }

    public function movements(): HasMany
    {
        return $this->hasMany(DocumentFolderMovement::class, 'folder_id')->latest();
    }

    public function getPathAttribute(): string
    {
        $parts = [];
        $folder = $this;
        while ($folder) {
            array_unshift($parts, $folder->name);
            $folder = $folder->parent;
        }
        return implode(' / ', $parts);
    }
}
