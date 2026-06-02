<?php

namespace App\Listeners;

use App\Models\AuditLog;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Auth\Events\Failed;

class LogAuthEvents
{
    public function handleLogin(Login $event): void
    {
        $event->user->forceFill(['last_login_at' => now()])->save();

        AuditLog::create([
            'user_id'        => $event->user->id,
            'user_name'      => $event->user->name,
            'ip_address'     => request()->ip(),
            'user_agent'     => request()->userAgent(),
            'action'         => 'login',
            'auditable_type' => $event->user::class,
            'auditable_id'   => $event->user->id,
            'description'    => "تسجيل دخول: {$event->user->name}",
            'created_at'     => now(),
        ]);
    }

    public function handleLogout(Logout $event): void
    {
        if (!$event->user) return;

        AuditLog::create([
            'user_id'        => $event->user->id,
            'user_name'      => $event->user->name,
            'ip_address'     => request()->ip(),
            'user_agent'     => request()->userAgent(),
            'action'         => 'logout',
            'auditable_type' => $event->user::class,
            'auditable_id'   => $event->user->id,
            'description'    => "تسجيل خروج: {$event->user->name}",
            'created_at'     => now(),
        ]);
    }

    public function handleFailedLogin(Failed $event): void
    {
        $email = $event->credentials['email'] ?? 'unknown';

        AuditLog::create([
            'user_id'        => null,
            'user_name'      => $email,
            'ip_address'     => request()->ip(),
            'user_agent'     => request()->userAgent(),
            'action'         => 'login_failed',
            'auditable_type' => \App\Models\User::class,
            'auditable_id'   => 0,
            'description'    => "محاولة دخول فاشلة: {$email}",
            'created_at'     => now(),
        ]);
    }
}
