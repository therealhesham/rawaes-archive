<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        // Spatie permission tables
        if (!DB::getSchemaBuilder()->hasTable('permissions') || !DB::getSchemaBuilder()->hasTable('roles')) {
            return;
        }

        $now = now();
        $permissions = [
            'documents.trash.view',
            'documents.restore',
            'documents.force_delete',
        ];

        foreach ($permissions as $name) {
            DB::table('permissions')->updateOrInsert(
                ['name' => $name, 'guard_name' => 'web'],
                ['created_at' => $now, 'updated_at' => $now]
            );
        }

        if (!DB::getSchemaBuilder()->hasTable('role_has_permissions')) {
            return;
        }

        $permIds = DB::table('permissions')
            ->whereIn('name', $permissions)
            ->pluck('id', 'name');

        $superAdminId = DB::table('roles')->where('name', 'super-admin')->value('id');
        $archiveManagerId = DB::table('roles')->where('name', 'archive-manager')->value('id');

        if ($superAdminId) {
            foreach ($permIds as $pid) {
                DB::table('role_has_permissions')->updateOrInsert(
                    ['role_id' => $superAdminId, 'permission_id' => $pid],
                    []
                );
            }
        }

        // archive-manager gets view+restore (not force delete by default)
        if ($archiveManagerId) {
            foreach (['documents.trash.view', 'documents.restore'] as $name) {
                $pid = $permIds[$name] ?? null;
                if (!$pid) continue;
                DB::table('role_has_permissions')->updateOrInsert(
                    ['role_id' => $archiveManagerId, 'permission_id' => $pid],
                    []
                );
            }
        }

        // Ensure Spatie cache is refreshed when manipulating DB directly.
        if (class_exists(PermissionRegistrar::class)) {
            app(PermissionRegistrar::class)->forgetCachedPermissions();
        }
    }

    public function down(): void
    {
        // Keep permissions to avoid breaking existing role setups.
    }
};
