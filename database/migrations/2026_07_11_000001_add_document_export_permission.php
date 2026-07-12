<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        if (!DB::getSchemaBuilder()->hasTable('permissions') || !DB::getSchemaBuilder()->hasTable('roles')) {
            return;
        }

        $now = now();

        DB::table('permissions')->updateOrInsert(
            ['name' => 'documents.export', 'guard_name' => 'web'],
            ['created_at' => $now, 'updated_at' => $now]
        );

        if (!DB::getSchemaBuilder()->hasTable('role_has_permissions')) {
            return;
        }

        $permId = DB::table('permissions')
            ->where('name', 'documents.export')
            ->where('guard_name', 'web')
            ->value('id');

        $superAdminId = DB::table('roles')->where('name', 'super-admin')->value('id');

        if ($superAdminId && $permId) {
            DB::table('role_has_permissions')->updateOrInsert(
                ['role_id' => $superAdminId, 'permission_id' => $permId],
                []
            );
        }

        // Do not auto-grant to other roles; admin can assign from Roles screen.

        if (class_exists(PermissionRegistrar::class)) {
            app(PermissionRegistrar::class)->forgetCachedPermissions();
        }
    }

    public function down(): void
    {
        // Keep permissions to avoid breaking existing role setups.
    }
};
