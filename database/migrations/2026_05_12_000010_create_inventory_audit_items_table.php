<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_audit_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('audit_id')->constrained('inventory_audits')->cascadeOnDelete();
            $table->foreignId('physical_folder_id')->constrained('physical_folders')->cascadeOnDelete();
            $table->string('expected_code', 36); // inventory_code at audit start
            $table->enum('status', ['pending', 'found', 'missing'])->default('pending');
            $table->foreignId('scanned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('scanned_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['audit_id', 'physical_folder_id']);
            $table->index(['audit_id', 'status']);
            $table->index(['audit_id', 'expected_code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_audit_items');
    }
};

