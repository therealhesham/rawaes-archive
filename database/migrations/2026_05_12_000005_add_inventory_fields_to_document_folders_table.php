<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    private function generateCode(): string
    {
        // Short, human-friendly code for labels/QR (e.g., A1B2C3D4).
        return Str::upper(Str::random(8));
    }

    public function up(): void
    {
        Schema::table('document_folders', function (Blueprint $table) {
            $table->string('inventory_code', 12)->nullable()->unique()->after('qr_code');
            $table->boolean('is_checked_out')->default(false)->after('is_active');
            $table->string('checked_out_to')->nullable()->after('is_checked_out');
            $table->foreignId('checked_out_by')->nullable()->constrained('users')->nullOnDelete()->after('checked_out_to');
            $table->dateTime('checked_out_at')->nullable()->after('checked_out_by');
            $table->text('checked_out_notes')->nullable()->after('checked_out_at');
        });

        // Backfill inventory_code for existing folders.
        DB::table('document_folders')
            ->whereNull('inventory_code')
            ->orderBy('id')
            ->chunkById(500, function ($rows) {
                foreach ($rows as $row) {
                    $code = null;
                    for ($i = 0; $i < 10; $i++) {
                        $candidate = Str::upper(Str::random(8));
                        $exists = DB::table('document_folders')->where('inventory_code', $candidate)->exists();
                        if (!$exists) {
                            $code = $candidate;
                            break;
                        }
                    }
                    $code = $code ?? (string) Str::uuid();
                    DB::table('document_folders')->where('id', $row->id)->update(['inventory_code' => $code]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('document_folders', function (Blueprint $table) {
            $table->dropForeign(['checked_out_by']);
            $table->dropUnique(['inventory_code']);
            $table->dropColumn([
                'inventory_code',
                'is_checked_out',
                'checked_out_to',
                'checked_out_by',
                'checked_out_at',
                'checked_out_notes',
            ]);
        });
    }
};

