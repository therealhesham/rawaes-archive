<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $user,
                'roles' => $user ? $user->getRoleNames() : [],
                'permissions' => $user ? $user->getAllPermissions()->pluck('name') : [],
                'can' => $user ? [
                    'documents.create' => $user->can('documents.create'),
                    'documents.delete' => $user->can('documents.delete'),
                    'documents.custody.checkout' => $user->can('documents.custody.checkout'),
                    'documents.custody.checkin' => $user->can('documents.custody.checkin'),
                    'documents.trash.view' => $user->can('documents.trash.view'),
                    'documents.restore' => $user->can('documents.restore'),
                    'documents.force_delete' => $user->can('documents.force_delete'),
                    'folders.manage' => $user->can('folders.manage'),
                    'sectors.manage' => $user->can('sectors.manage'),
                    'users.manage' => $user->can('users.manage'),
                    'audit.view' => $user->can('audit.view'),
                    'reports.view' => $user->can('reports.view'),
                    'inventory.view' => $user->can('inventory.view'),
                    'inventory.manage' => $user->can('inventory.manage'),
                ] : [],
            ],
            'notifications' => fn() => $user ? [
                'unread_count' => $user->unreadNotifications()->count(),
                'recent' => $user->unreadNotifications()->take(5)->get()->map(fn($n) => [
                    'id' => $n->id,
                    'data' => $n->data,
                    'created_at' => $n->created_at->diffForHumans(),
                ]),
            ] : ['unread_count' => 0, 'recent' => []],
            'pendingScansCount' => fn() => $user ? \App\Models\PendingScan::where('status', 'new')->count() : 0,
            'scanBridge' => [
                'token' => $user ? config('services.scan.token') : null,
            ],
            'flash' => [
                'success' => fn() => $request->session()->get('success'),
                'error' => fn() => $request->session()->get('error'),
            ],
        ];
    }
}
