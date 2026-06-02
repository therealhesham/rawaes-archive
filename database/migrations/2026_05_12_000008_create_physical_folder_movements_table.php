<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('physical_folder_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('physical_folder_id')->constrained('physical_folders')->cascadeOnDelete();
            $table->enum('action', ['checkout', 'checkin']);
            $table->string('to_person')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('physical_folder_movements');
    }
};

