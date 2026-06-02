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
        Schema::create('pending_scans', function (Blueprint $table) {
            $table->id();
            $table->string('original_name');
            $table->string('file_path');
            $table->string('file_extension', 10);
            $table->unsignedBigInteger('file_size');
            $table->string('mime_type');
            $table->string('source')->default('scanner'); // scanner|email|api
            $table->string('source_device')->nullable(); // identifier of the source device/PC
            $table->string('thumbnail')->nullable();
            $table->enum('status', ['new', 'assigned', 'rejected'])->default('new');
            $table->foreignId('assigned_to_document_id')->nullable()->constrained('archive_documents')->nullOnDelete();
            $table->foreignId('claimed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('claimed_at')->nullable();
            $table->timestamps();

            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pending_scans');
    }
};
