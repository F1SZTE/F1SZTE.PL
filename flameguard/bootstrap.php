<?php
declare(strict_types=1);

date_default_timezone_set('Europe/Warsaw');
ini_set('display_errors', '0');
ini_set('log_errors', '1');

$fgConfigPath = __DIR__ . '/config.php';
if (!is_file($fgConfigPath)) {
    throw new RuntimeException('Missing config.php. Copy config.php.example and enter the database settings.');
}
$fgConfig = require $fgConfigPath;
if (!is_array($fgConfig) || empty($fgConfig['database'])) {
    throw new RuntimeException('Invalid FlameGuard configuration.');
}

$fgIsHttps = (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off')
    || ((int) ($_SERVER['SERVER_PORT'] ?? 0) === 443);
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $fgIsHttps,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function fg_db(): PDO
{
    static $pdo = null;
    global $fgConfig;
    if ($pdo instanceof PDO) return $pdo;

    $db = $fgConfig['database'];
    foreach (['host', 'name', 'user', 'password'] as $key) {
        if (!array_key_exists($key, $db)) throw new RuntimeException('Database settings are incomplete.');
    }
    $charset = $db['charset'] ?? 'utf8mb4';
    $dsn = 'mysql:host=' . $db['host'] . ';dbname=' . $db['name'] . ';charset=' . $charset;
    $pdo = new PDO($dsn, (string) $db['user'], (string) $db['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}

function fg_json(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, private');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fg_csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    return (string) $_SESSION['csrf_token'];
}

function fg_require_csrf(): void
{
    $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($provided) || !hash_equals(fg_csrf_token(), $provided)) {
        fg_json(['ok' => false, 'error' => 'csrf'], 419);
    }
}

function fg_json_body(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '', true);
    if (!is_array($data)) fg_json(['ok' => false, 'error' => 'invalid_json'], 400);
    return $data;
}

function fg_current_user(): ?array
{
    if (empty($_SESSION['user_id'])) return null;
    $stmt = fg_db()->prepare('SELECT user_id, username, display_name, user_role FROM fg_users WHERE user_id = ?');
    $stmt->execute([(int) $_SESSION['user_id']]);
    $user = $stmt->fetch();
    if (!$user) {
        unset($_SESSION['user_id']);
        return null;
    }
    return [
        'id' => (int) $user['user_id'],
        'username' => $user['username'],
        'display_name' => $user['display_name'],
        'role' => $user['user_role'],
    ];
}

function fg_require_user(): array
{
    $user = fg_current_user();
    if (!$user) fg_json(['ok' => false, 'error' => 'login_required'], 401);
    return $user;
}

function fg_require_admin(): array
{
    $user = fg_require_user();
    if ($user['role'] !== 'admin') fg_json(['ok' => false, 'error' => 'admin_required'], 403);
    return $user;
}

function fg_valid_date(string $value): bool
{
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    return $date !== false && $date->format('Y-m-d') === $value;
}

function fg_valid_datetime(string $value): ?DateTimeImmutable
{
    $date = DateTimeImmutable::createFromFormat('!Y-m-d H:i', $value);
    $errors = DateTimeImmutable::getLastErrors();
    if ($date === false || (is_array($errors) && ($errors['warning_count'] || $errors['error_count']))) return null;
    return $date->format('Y-m-d H:i') === $value ? $date : null;
}

function fg_api_datetime(string $value): string
{
    $date = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $value, new DateTimeZone('Europe/Warsaw'));
    return $date ? $date->format(DateTimeInterface::ATOM) : $value;
}
