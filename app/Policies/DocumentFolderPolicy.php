<?php

namespace App\Policies;

use App\Models\DocumentFolder;
use App\Models\User;

class DocumentFolderPolicy
{
    public function before(User $user, string $ability): ?bool
    {
        if ($user->hasRole('super-admin')) return true;
        return null;
    }

    public function viewAny(User $user): bool { return $user->can('documents.view'); }

    public function view(User $user, DocumentFolder $folder): bool
    {
        if ($user->hasAnyRole(['archive-manager', 'auditor'])) return true;
        return !$user->sector_id || $user->sector_id === $folder->sector_id;
    }

    public function create(User $user): bool { return $user->can('folders.manage'); }
    public function update(User $user, DocumentFolder $folder): bool { return $user->can('folders.manage'); }
    public function delete(User $user, DocumentFolder $folder): bool { return $user->can('folders.manage'); }
}
