<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Sector extends Model
{
    use SoftDeletes;

    protected $fillable = ['name', 'name_en', 'code', 'description', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];

    public function folders(): HasMany
    {
        return $this->hasMany(DocumentFolder::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(ArchiveDocument::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
