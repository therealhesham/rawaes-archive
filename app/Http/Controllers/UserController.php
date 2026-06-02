<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\DocumentFolder;
use App\Models\Sector;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Spatie\Permission\Models\Role;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $users = User::with(['sector:id,name', 'roles:id,name'])
            ->when($request->search, fn($q) => $q->where(function ($sub) use ($request) {
                $sub->where('name', 'like', "%{$request->search}%")
                    ->orWhere('email', 'like', "%{$request->search}%")
                    ->orWhere('employee_id', 'like', "%{$request->search}%");
            }))
            ->when($request->sector_id, fn($q) => $q->where('sector_id', $request->sector_id))
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('Users/Index', [
            'users' => $users,
            'sectors' => Sector::where('is_active', true)->get(['id', 'name']),
            'filters' => $request->only(['search', 'sector_id']),
        ]);
    }

    public function create()
    {
        return Inertia::render('Users/Form', [
            'sectors' => Sector::where('is_active', true)->get(['id', 'name']),
            'folders' => DocumentFolder::with('sector:id,name')
                ->where('is_active', true)
                ->get(['id', 'sector_id', 'parent_id', 'name']),
            'roles' => Role::all(['id', 'name']),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|min:6|confirmed',
            'employee_id' => 'nullable|string|max:50|unique:users,employee_id',
            'sector_id' => 'nullable|exists:sectors,id',
            'department' => 'nullable|string|max:255',
            'job_title' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:20',
            'role' => 'required|string|exists:roles,name',
            'is_active' => 'boolean',
            'allowed_sector_ids' => 'array',
            'allowed_sector_ids.*' => 'integer|exists:sectors,id',
            'allowed_folder_ids' => 'array',
            'allowed_folder_ids.*' => 'integer|exists:document_folders,id',
        ]);

        $user = User::create([
            ...collect($validated)->except(['allowed_sector_ids', 'allowed_folder_ids', 'role'])->toArray(),
            'password' => Hash::make($validated['password']),
        ]);
        $user->assignRole($validated['role']);
        $user->allowedSectors()->sync($validated['allowed_sector_ids'] ?? []);
        $user->allowedFolders()->sync($validated['allowed_folder_ids'] ?? []);

        AuditLog::record('create_user', $user, [], $user->toArray(), "إنشاء مستخدم: {$user->name}");

        return redirect()->route('users.index')
            ->with('success', 'تم إنشاء المستخدم بنجاح');
    }

    public function edit(User $user)
    {
        $user->load('roles');
        $userData = $user->toArray();
        $userData['allowed_sectors'] = $user->allowedSectors()->get(['sectors.id'])->toArray();
        $userData['allowed_folders'] = $user->allowedFolders()->get(['document_folders.id'])->toArray();

        return Inertia::render('Users/Form', [
            'user' => $userData,
            'sectors' => Sector::where('is_active', true)->get(['id', 'name']),
            'folders' => DocumentFolder::where('is_active', true)
                ->get(['id', 'sector_id', 'parent_id', 'name']),
            'roles' => Role::all(['id', 'name']),
        ]);
    }

    public function update(Request $request, User $user)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => ['required', 'email', Rule::unique('users')->ignore($user->id)],
            'password' => 'nullable|min:6|confirmed',
            'employee_id' => ['nullable', 'string', 'max:50', Rule::unique('users')->ignore($user->id)],
            'sector_id' => 'nullable|exists:sectors,id',
            'department' => 'nullable|string|max:255',
            'job_title' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:20',
            'role' => 'required|string|exists:roles,name',
            'is_active' => 'boolean',
            'allowed_sector_ids' => 'array',
            'allowed_sector_ids.*' => 'integer|exists:sectors,id',
            'allowed_folder_ids' => 'array',
            'allowed_folder_ids.*' => 'integer|exists:document_folders,id',
        ]);

        $old = $user->toArray();

        $updateData = collect($validated)->except(['password', 'role', 'allowed_sector_ids', 'allowed_folder_ids'])->toArray();
        if (!empty($validated['password'])) {
            $updateData['password'] = Hash::make($validated['password']);
        }

        $user->update($updateData);
        $user->syncRoles([$validated['role']]);
        $user->allowedSectors()->sync($validated['allowed_sector_ids'] ?? []);
        $user->allowedFolders()->sync($validated['allowed_folder_ids'] ?? []);

        AuditLog::record('update_user', $user, $old, $user->fresh()->toArray(), "تعديل مستخدم: {$user->name}");

        return redirect()->route('users.index')
            ->with('success', 'تم التحديث بنجاح');
    }

    public function destroy(User $user)
    {
        if ($user->id === auth()->id()) {
            return back()->with('error', 'لا يمكنك حذف حسابك');
        }

        AuditLog::record('delete_user', $user, $user->toArray(), [], "حذف مستخدم: {$user->name}");
        $user->delete();

        return back()->with('success', 'تم الحذف');
    }

    public function show(User $user)
    {
        return redirect()->route('users.index');
    }
}
