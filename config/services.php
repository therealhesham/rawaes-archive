<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ocr' => [
        'api_key' => env('OCR_SPACE_API_KEY', 'helloworld'),
    ],

    'scan' => [
        'token' => env('SCAN_API_TOKEN'),
    ],

    'notion' => [
        'token' => env('NOTION_API_TOKEN'),
        'database_id' => env('NOTION_DATABASE_ID'),
    ],

    'integration' => [
        // Shared token for external systems that need to upload documents without user login.
        'token' => env('INTEGRATION_API_TOKEN'),
        // Optional: set a specific user id to attribute uploads to (fallback: first super-admin).
        'uploader_user_id' => env('INTEGRATION_UPLOADER_USER_ID'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
