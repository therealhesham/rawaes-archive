<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('archive_documents', function (Blueprint $table) {
            if (!Schema::hasColumn('archive_documents', 'serial_number')) {
                $table->unsignedBigInteger('serial_number')->nullable()->after('id');
                $table->unique('serial_number');
            }
        });

        // Backfill existing documents in creation order (keeps "gaps" when deleted later).
        $counter = 0;
        DB::table('archive_documents')
            ->orderBy('created_at')
            ->orderBy('id')
            ->select('id')
            ->chunk(500, function ($rows) use (&$counter) {
                foreach ($rows as $row) {
                    $counter++;
                    DB::table('archive_documents')
                        ->where('id', $row->id)
                        ->update(['serial_number' => $counter]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('archive_documents', function (Blueprint $table) {
            if (Schema::hasColumn('archive_documents', 'serial_number')) {
                $table->dropUnique(['serial_number']);
                $table->dropColumn('serial_number');
            }
        });
    }
};
