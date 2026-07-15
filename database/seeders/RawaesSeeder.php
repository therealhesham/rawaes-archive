<?php

namespace Database\Seeders;

use App\Models\DocumentFolder;
use App\Models\DocumentType;
use App\Models\Sector;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RawaesSeeder extends Seeder
{
    public function run(): void
    {
        // Roles
        $roles = ['super-admin', 'archive-manager', 'employee', 'auditor'];
        foreach ($roles as $role) {
            Role::firstOrCreate(['name' => $role]);
        }

        // Permissions
        $permissions = [
            'documents.view', 'documents.create', 'documents.edit',
            'documents.delete', 'documents.download', 'documents.print',
            'documents.custody.checkout', 'documents.custody.checkin',
            'documents.trash.view', 'documents.restore', 'documents.force_delete',
            'documents.ai_extract',
            'folders.manage', 'sectors.manage', 'users.manage',
            'audit.view', 'reports.view',
            'inventory.view',
            'inventory.manage',
        ];
        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm]);
        }

        Role::findByName('super-admin')->givePermissionTo(Permission::all());
        Role::findByName('archive-manager')->givePermissionTo([
            'documents.view', 'documents.create', 'documents.edit',
            'documents.download', 'folders.manage', 'audit.view', 'reports.view',
            'documents.trash.view', 'documents.restore',
            'inventory.view',
            'inventory.manage',
        ]);
        Role::findByName('employee')->givePermissionTo([
            'documents.view', 'documents.create', 'documents.download',
            'inventory.view',
        ]);
        Role::findByName('auditor')->givePermissionTo([
            'documents.view', 'audit.view', 'reports.view',
            'inventory.view',
        ]);

        // Admin user
        $admin = User::firstOrCreate(
            ['email' => 'admin@rawaes.com'],
            [
                'name' => 'مدير النظام',
                'password' => Hash::make('password'),
                'employee_id' => 'EMP001',
                'job_title' => 'مدير النظام',
                'is_active' => true,
            ]
        );
        $admin->assignRole('super-admin');

        // Sectors
        $sectors = [
            ['name' => 'قطاع الفنادق', 'name_en' => 'Hotels Sector', 'code' => 'HTL'],
            ['name' => 'قطاع التأجير', 'name_en' => 'Rental Sector', 'code' => 'RNT'],
            ['name' => 'الإدارة المالية', 'name_en' => 'Finance', 'code' => 'FIN'],
            ['name' => 'الموارد البشرية', 'name_en' => 'HR', 'code' => 'HR'],
            ['name' => 'قطاع الاستقدام', 'name_en' => 'Recruitment', 'code' => 'REC'],
            ['name' => 'الإدارة العامة', 'name_en' => 'General Admin', 'code' => 'ADM'],
        ];

        foreach ($sectors as $sData) {
            $sector = Sector::firstOrCreate(['code' => $sData['code']], $sData);

            // Create root folders per sector
            $rootFolders = [
                ['name' => 'العقود', 'name_en' => 'Contracts', 'icon' => 'file-contract', 'color' => '#3B82F6'],
                ['name' => 'الفواتير', 'name_en' => 'Invoices', 'icon' => 'receipt', 'color' => '#10B981'],
                ['name' => 'التراخيص', 'name_en' => 'Licenses', 'icon' => 'id-card', 'color' => '#F59E0B'],
                ['name' => 'المراسلات', 'name_en' => 'Correspondence', 'icon' => 'mail', 'color' => '#8B5CF6'],
                ['name' => 'التقارير', 'name_en' => 'Reports', 'icon' => 'chart', 'color' => '#EF4444'],
            ];

            foreach ($rootFolders as $i => $fData) {
                DocumentFolder::firstOrCreate(
                    ['sector_id' => $sector->id, 'name' => $fData['name'], 'parent_id' => null],
                    [...$fData, 'sector_id' => $sector->id, 'sort_order' => $i]
                );
            }
        }

        // Document types
        $docTypes = [
            ['name' => 'عقد', 'name_en' => 'Contract', 'code' => 'CONTRACT', 'requires_expiry' => true],
            ['name' => 'فاتورة', 'name_en' => 'Invoice', 'code' => 'INVOICE', 'requires_expiry' => false],
            ['name' => 'ترخيص', 'name_en' => 'License', 'code' => 'LICENSE', 'requires_expiry' => true],
            ['name' => 'سجل تجاري', 'name_en' => 'Commercial Register', 'code' => 'CR', 'requires_expiry' => true],
            ['name' => 'وثيقة هوية', 'name_en' => 'ID Document', 'code' => 'ID', 'requires_expiry' => true],
            ['name' => 'تقرير', 'name_en' => 'Report', 'code' => 'REPORT', 'requires_expiry' => false],
            ['name' => 'مراسلة', 'name_en' => 'Correspondence', 'code' => 'CORR', 'requires_expiry' => false],
            ['name' => 'وثيقة تأمين', 'name_en' => 'Insurance', 'code' => 'INS', 'requires_expiry' => true],
        ];

        foreach ($docTypes as $type) {
            DocumentType::firstOrCreate(['code' => $type['code']], $type);
        }

        $this->command->info('✅ تم إنشاء البيانات الأولية بنجاح');
        $this->command->info('📧 البريد: admin@rawaes.com');
        $this->command->info('🔑 كلمة المرور: password');
    }
}
