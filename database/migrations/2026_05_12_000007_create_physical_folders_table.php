<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('physical_folders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sector_id')->nullable()->constrained()->nullOnDelete();
            // Optional classification against the system folders tree (DocumentFolder)
            $table->foreignId('document_folder_id')->nullable()->constrained('document_folders')->nullOnDelete();

            $table->string('name');
            $table->text('description')->nullable();
            $table->string('location')->nullable(); // shelf/room/box code

            $table->string('inventory_code', 12)->unique(); // short code for label/QR
            $table->string('qr_code', 36)->unique(); // what QR encodes (default = inventory_code)

            $table->boolean('is_active')->default(true);

            // Checkout/Checkin state
            $table->boolean('is_checked_out')->default(false);
            $table->string('checked_out_to')->nullable();
            $table->foreignId('checked_out_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('checked_out_at')->nullable();
            $table->text('checked_out_notes')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('physical_folders');
    }
};

