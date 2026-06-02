<?php

namespace App\Policies;

use App\Models\ArchiveDocument;
use App\Models\User;

class ArchiveDocumentPolicy
{
    public function before(User $user, string $ability): ?bool
    {
        if ($user->hasRole('super-admin')) return true;
        return null;
    }

    public function viewAny(User $user): bool
    {
        return $user->can('documents.view');
    }

    public function view(User $user, ArchiveDocument $document): bool
    {
        if (!$user->can('documents.view')) return false;

        $allowedIds = $user->accessibleSectorIds(); // [] = all

        if ($document->is_confidential) {
            if ($document->uploaded_by === $user->id) return true;
            if ($user->hasRole('archive-manager')
                && (empty($allowedIds) || in_array($document->sector_id, $allowedIds))) return true;
            return false;
        }

        if ($user->hasAnyRole(['archive-manager', 'auditor'])) return true;
        if (!empty($allowedIds) && !in_array($document->sector_id, $allowedIds)) return false;

        return true;
    }

    public function create(User $user): bool
    {
        return $user->can('documents.create');
    }

    public function update(User $user, ArchiveDocument $document): bool
    {
        if (!$user->can('documents.edit')) return false;

        $allowedIds = $user->accessibleSectorIds();

        if ($user->hasRole('archive-manager')) {
            return empty($allowedIds) || in_array($document->sector_id, $allowedIds);
        }
        return $document->uploaded_by === $user->id;
    }

    public function delete(User $user, ArchiveDocument $document): bool
    {
        if (!$user->can('documents.delete')) return false;

        $allowedIds = $user->accessibleSectorIds();

        return $user->hasRole('archive-manager')
            && (empty($allowedIds) || in_array($document->sector_id, $allowedIds));
    }

    public function download(User $user, ArchiveDocument $document): bool
    {
        if (!$user->can('documents.download')) return false;
        return $this->view($user, $document);
    }
}
