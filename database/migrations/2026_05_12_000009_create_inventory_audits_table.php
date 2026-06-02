<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_audits', function (Blueprint $table) {
            $table->id();
            $table->string('title')->nullable();
            $table->enum('status', ['running', 'paused', 'completed'])->default('running');
            $table->foreignId('started_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('started_at')->nullable();
            $table->foreignId('ended_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('ended_at')->nullable();
            $table->text('notes')->nullable();
            $table->json('result')->nullable(); // summary snapshot at completion
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_audits');
    }
};

