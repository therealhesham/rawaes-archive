<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_folder_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('folder_id')->constrained('document_folders')->cascadeOnDelete();
            $table->enum('action', ['checkout', 'checkin']);
            $table->string('to_person')->nullable(); // who it was delivered to (for checkout)
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_folder_movements');
    }
};

