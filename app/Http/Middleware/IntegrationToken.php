<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class IntegrationToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = (string) $request->header('X-Integration-Token', '');
        $expected = (string) config('services.integration.token');

        if ($expected === '' || !hash_equals($expected, $token)) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        return $next($request);
    }
}

