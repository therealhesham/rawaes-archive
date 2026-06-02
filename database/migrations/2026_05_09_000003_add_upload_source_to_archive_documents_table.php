<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('archive_documents', function (Blueprint $table) {
            if (!Schema::hasColumn('archive_documents', 'upload_source')) {
                $table->string('upload_source', 20)->default('web')->after('uploaded_by');
                $table->index('upload_source');
            }
        });

        // Backfill older records based on audit log message.
        $scannerIds = DB::table('audit_logs')
            ->where('auditable_type', 'App\\Models\\ArchiveDocument')
            ->where('description', 'like', 'أرشفة من السكانر:%')
            ->pluck('auditable_id');

        if ($scannerIds->isNotEmpty()) {
            DB::table('archive_documents')
                ->whereIn('id', $scannerIds)
                ->update(['upload_source' => 'scanner']);
        }

        DB::table('archive_documents')
            ->whereNull('upload_source')
            ->update(['upload_source' => 'web']);
    }

    public function down(): void
    {
        Schema::table('archive_documents', function (Blueprint $table) {
            if (Schema::hasColumn('archive_documents', 'upload_source')) {
                $table->dropIndex(['upload_source']);
                $table->dropColumn('upload_source');
            }
        });
    }
};

