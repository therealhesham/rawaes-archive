<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('archive_documents', function (Blueprint $table) {
            // Make migration idempotent (some installs may already have these columns).
            if (!Schema::hasColumn('archive_documents', 'is_checked_out')) {
                $table->boolean('is_checked_out')->default(false)->after('is_confidential');
            }
            if (!Schema::hasColumn('archive_documents', 'checked_out_to')) {
                $table->string('checked_out_to')->nullable()->after('is_checked_out');
            }
            if (!Schema::hasColumn('archive_documents', 'checked_out_by')) {
                $table->foreignId('checked_out_by')->nullable()->constrained('users')->nullOnDelete()->after('checked_out_to');
            }
            if (!Schema::hasColumn('archive_documents', 'checked_out_at')) {
                $table->dateTime('checked_out_at')->nullable()->after('checked_out_by');
            }
            if (!Schema::hasColumn('archive_documents', 'checked_out_notes')) {
                $table->text('checked_out_notes')->nullable()->after('checked_out_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('archive_documents', function (Blueprint $table) {
            if (Schema::hasColumn('archive_documents', 'checked_out_by')) {
                // If FK exists it will be dropped; if not, this may throw in some DBs.
                try { $table->dropForeign(['checked_out_by']); } catch (\Throwable $e) {}
            }
            $cols = ['is_checked_out', 'checked_out_to', 'checked_out_by', 'checked_out_at', 'checked_out_notes'];
            $existing = array_values(array_filter($cols, fn($c) => Schema::hasColumn('archive_documents', $c)));
            if (!empty($existing)) {
                $table->dropColumn($existing);
            }
        });
    }
};
