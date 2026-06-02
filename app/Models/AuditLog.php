<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    public $timestamps = false;
    public $updatable = false;

    protected $fillable = [
        'user_id', 'user_name', 'ip_address', 'user_agent',
        'action', 'auditable_type', 'auditable_id',
        'old_values', 'new_values', 'description', 'created_at',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
        'created_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function record(string $action, Model $model, array $old = [], array $new = [], ?string $description = null): void
    {
        $user = auth()->user();
        static::create([
            'user_id' => $user?->id,
            'user_name' => $user?->name ?? 'System',
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'action' => $action,
            'auditable_type' => get_class($model),
            'auditable_id' => $model->getKey(),
            'old_values' => $old ?: null,
            'new_values' => $new ?: null,
            'description' => $description,
            'created_at' => now(),
        ]);
    }
}
