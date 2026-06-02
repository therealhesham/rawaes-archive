<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('physical_folder_movements')) {
            return;
        }

        Schema::table('physical_folder_movements', function (Blueprint $table) {
            if (!Schema::hasColumn('physical_folder_movements', 'signature_path')) {
                $table->string('signature_path')->nullable()->after('notes');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('physical_folder_movements')) {
            return;
        }

        Schema::table('physical_folder_movements', function (Blueprint $table) {
            if (Schema::hasColumn('physical_folder_movements', 'signature_path')) {
                $table->dropColumn('signature_path');
            }
        });
    }
};

