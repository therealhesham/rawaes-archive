<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasFactory, Notifiable, HasRoles, SoftDeletes;

    protected $fillable = [
        'name', 'email', 'password', 'sector_id', 'employee_id',
        'department', 'job_title', 'phone', 'avatar', 'is_active',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'last_login_at' => 'datetime',
        ];
    }

    public function sector(): BelongsTo
    {
        return $this->belongsTo(Sector::class);
    }

    public function allowedSectors(): BelongsToMany
    {
        return $this->belongsToMany(Sector::class, 'user_sectors')
            ->withPivot('can_upload');
    }

    public function allowedFolders(): BelongsToMany
    {
        return $this->belongsToMany(DocumentFolder::class, 'user_folders', 'user_id', 'folder_id')
            ->withPivot('can_upload');
    }

    /**
     * Returns sector IDs user can access (primary + allowed).
     * Empty array means: no restriction (admin/manager).
     */
    public function accessibleSectorIds(): array
    {
        if ($this->hasAnyRole(['super-admin', 'archive-manager', 'auditor'])) {
            return []; // means: all
        }

        $ids = $this->allowedSectors->pluck('id')->toArray();
        if ($this->sector_id && !in_array($this->sector_id, $ids)) {
            $ids[] = $this->sector_id;
        }
        return $ids;
    }

    /**
     * Returns folder IDs user can access. Empty = no restriction.
     */
    public function accessibleFolderIds(): array
    {
        if ($this->hasAnyRole(['super-admin', 'archive-manager', 'auditor'])) {
            return [];
        }

        return $this->allowedFolders->pluck('id')->toArray();
    }
}
