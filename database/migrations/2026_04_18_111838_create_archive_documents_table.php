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
        Schema::create('archive_documents', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('document_number')->nullable();
            $table->foreignId('folder_id')->constrained('document_folders')->restrictOnDelete();
            $table->foreignId('document_type_id')->constrained()->restrictOnDelete();
            $table->foreignId('sector_id')->constrained()->restrictOnDelete();
            $table->foreignId('uploaded_by')->constrained('users')->restrictOnDelete();
            $table->string('file_path');
            $table->string('file_name');
            $table->string('file_extension');
            $table->unsignedBigInteger('file_size');
            $table->string('mime_type');
            $table->string('issuing_entity')->nullable();
            $table->date('issue_date')->nullable();
            $table->date('expiry_date')->nullable();
            $table->string('physical_location')->nullable();
            $table->string('qr_code')->nullable()->unique();
            $table->string('barcode')->nullable()->unique();
            $table->text('ocr_content')->nullable();
            $table->json('tags')->nullable();
            $table->text('notes')->nullable();
            $table->enum('status', ['active', 'expired', 'archived', 'pending_review'])->default('active');
            $table->boolean('is_confidential')->default(false);
            $table->timestamp('expiry_notified_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['sector_id', 'status']);
            $table->index('expiry_date');
            $table->index('document_number');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('archive_documents');
    }
};
