<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('sector_id')->nullable()->after('email')->constrained()->nullOnDelete();
            $table->string('employee_id')->nullable()->after('sector_id')->unique();
            $table->string('department')->nullable()->after('employee_id');
            $table->string('job_title')->nullable()->after('department');
            $table->string('phone')->nullable()->after('job_title');
            $table->string('avatar')->nullable()->after('phone');
            $table->boolean('is_active')->default(true)->after('avatar');
            $table->timestamp('last_login_at')->nullable()->after('is_active');
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['sector_id', 'employee_id', 'department', 'job_title', 'phone', 'avatar', 'is_active', 'last_login_at', 'deleted_at']);
        });
    }
};
