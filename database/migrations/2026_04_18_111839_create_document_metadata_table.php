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
        Schema::create('document_metadata', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained('archive_documents')->cascadeOnDelete();
            $table->string('key');
            $table->text('value')->nullable();
            $table->string('type')->default('string');
            $table->timestamps();

            $table->index(['document_id', 'key']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('document_metadata');
    }
};
