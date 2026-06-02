<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolePermissionController extends Controller
{
    public function index()
    {
        abort_unless(auth()->user()->hasRole('super-admin'), 403);

        $roles = Role::with('permissions')->withCount('users')->get();
        $permissions = Permission::all();

        // Group permissions by resource
        $grouped = $permissions->groupBy(fn($p) => explode('.', $p->name)[0]);

        return Inertia::render('Roles/Index', [
            'roles' => $roles,
            'permissionGroups' => $grouped,
        ]);
    }

    public function updatePermissions(Request $request, Role $role)
    {
        abort_unless(auth()->user()->hasRole('super-admin'), 403);

        // Prevent removing all from super-admin
        if ($role->name === 'super-admin' && empty($request->permissions)) {
            return back()->with('error', 'لا يمكن إزالة كل صلاحيات المدير العام');
        }

        $validated = $request->validate([
            'permissions' => 'array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        $role->syncPermissions($validated['permissions'] ?? []);

        return back()->with('success', "تم تحديث صلاحيات «{$role->name}»");
    }

    public function storeRole(Request $request)
    {
        abort_unless(auth()->user()->hasRole('super-admin'), 403);

        $validated = $request->validate([
            'name' => 'required|string|max:100|unique:roles,name',
            'permissions' => 'array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        $role = Role::create(['name' => $validated['name']]);
        $role->syncPermissions($validated['permissions'] ?? []);

        return back()->with('success', 'تم إنشاء الدور بنجاح');
    }

    public function destroyRole(Role $role)
    {
        abort_unless(auth()->user()->hasRole('super-admin'), 403);

        if (in_array($role->name, ['super-admin', 'archive-manager', 'employee', 'auditor'])) {
            return back()->with('error', 'لا يمكن حذف الأدوار الأساسية');
        }
        if ($role->users()->count() > 0) {
            return back()->with('error', 'لا يمكن حذف دور مخصص لمستخدمين');
        }

        $role->delete();
        return back()->with('success', 'تم حذف الدور');
    }
}
