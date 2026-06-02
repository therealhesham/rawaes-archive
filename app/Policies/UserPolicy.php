<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    public function before(User $user, string $ability): ?bool
    {
        if ($user->hasRole('super-admin')) return true;
        return null;
    }

    public function viewAny(User $user): bool { return $user->can('users.manage'); }
    public function view(User $user, User $target): bool { return $user->can('users.manage') || $user->id === $target->id; }
    public function create(User $user): bool { return $user->can('users.manage'); }
    public function update(User $user, User $target): bool { return $user->can('users.manage'); }
    public function delete(User $user, User $target): bool
    {
        if ($user->id === $target->id) return false;
        return $user->can('users.manage');
    }
}
