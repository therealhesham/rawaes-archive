<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_folders', function (Blueprint $table) {
            $table->string('qr_code', 36)->nullable()->unique()->after('name_en');
        });

        // Backfill existing folders with a UUID QR code.
        DB::table('document_folders')
            ->whereNull('qr_code')
            ->orderBy('id')
            ->chunkById(500, function ($rows) {
                foreach ($rows as $row) {
                    DB::table('document_folders')
                        ->where('id', $row->id)
                        ->update(['qr_code' => (string) Str::uuid()]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('document_folders', function (Blueprint $table) {
            $table->dropUnique(['qr_code']);
            $table->dropColumn('qr_code');
        });
    }
};

