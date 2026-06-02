<?php

namespace App\Policies;

use App\Models\Sector;
use App\Models\User;

class SectorPolicy
{
    public function before(User $user, string $ability): ?bool
    {
        if ($user->hasRole('super-admin')) return true;
        return null;
    }

    public function viewAny(User $user): bool { return true; }
    public function view(User $user, Sector $sector): bool { return true; }
    public function create(User $user): bool { return $user->can('sectors.manage'); }
    public function update(User $user, Sector $sector): bool { return $user->can('sectors.manage'); }
    public function delete(User $user, Sector $sector): bool { return $user->can('sectors.manage'); }
}
