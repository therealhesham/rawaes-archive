<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('archive_document_movements')) {
            return;
        }

        Schema::create('archive_document_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained('archive_documents')->cascadeOnDelete();
            $table->enum('action', ['checkout', 'checkin']);
            $table->string('to_person')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['document_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('archive_document_movements');
    }
};
