<?php
declare(strict_types=1);

try {
    require __DIR__ . '/bootstrap.php';
    $pdo = fg_db();
    $installed = (bool) $pdo->query('SELECT installed_at FROM fg_app_settings WHERE setting_id = 1')->fetchColumn();
} catch (Throwable $error) {
    error_log('FlameGuard setup: ' . $error->getMessage());
    $installed = false;
    $pageError = 'Nie można połączyć się z bazą. Sprawdź config.php i upewnij się, że zaimportowano database.sql.';
}

$message = $pageError ?? '';
$complete = false;
if ($_SERVER['REQUEST_METHOD'] === 'POST' && empty($pageError) && !$installed) {
    $providedCsrf = (string) ($_POST['csrf_token'] ?? '');
    $configuredKey = (string) ($fgConfig['setup_key'] ?? '');
    $providedKey = (string) ($_POST['setup_key'] ?? '');
    if (!hash_equals(fg_csrf_token(), $providedCsrf)) {
        $message = 'Sesja wygasła. Odśwież stronę i spróbuj ponownie.';
    } elseif (strlen($configuredKey) < 32 || !hash_equals($configuredKey, $providedKey)) {
        $message = 'Ustaw w config.php własny losowy setup_key o długości co najmniej 32 znaków i wpisz go poniżej.';
    } else {
        $username = strtolower(trim((string) ($_POST['username'] ?? '')));
        $displayName = trim((string) ($_POST['display_name'] ?? ''));
        $password = (string) ($_POST['password'] ?? '');
        if (!preg_match('/^[a-z0-9_]{3,24}$/', $username)) {
            $message = 'Nazwa użytkownika musi mieć 3–24 znaki: litery bez polskich znaków, cyfry lub podkreślenia.';
        } elseif (strlen($displayName) < 2 || strlen($displayName) > 80) {
            $message = 'Nazwa wyświetlana musi mieć od 2 do 80 znaków.';
        } elseif (strlen($password) < 12 || strlen($password) > 200) {
            $message = 'Hasło administratora musi mieć co najmniej 12 znaków.';
        } else {
            try {
                $pdo->beginTransaction();
                $lock = $pdo->query('SELECT installed_at FROM fg_app_settings WHERE setting_id = 1 FOR UPDATE')->fetchColumn();
                if ($lock) {
                    $pdo->rollBack();
                    $installed = true;
                } else {
                    $stmt = $pdo->prepare('INSERT INTO fg_users (username, display_name, password_hash, user_role) VALUES (?, ?, ?, \'admin\')');
                    $stmt->execute([$username, $displayName, password_hash($password, PASSWORD_DEFAULT)]);
                    $pdo->exec('UPDATE fg_app_settings SET installed_at = NOW() WHERE setting_id = 1');
                    $pdo->commit();
                    $installed = true;
                    $complete = true;
                }
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                error_log('FlameGuard admin setup: ' . $error->getMessage());
                $message = 'Nie udało się utworzyć administratora. Sprawdź log błędów hostingu.';
            }
        }
    }
}

function fg_setup_escape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
?><!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Konfiguracja FlameGuard</title>
  <style>
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#dceaff;color:#17233a;font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}.panel{width:min(520px,100%);padding:32px;border:1px solid #fff;border-radius:22px;background:#fff;box-shadow:0 22px 65px #31528220}h1{margin:0 0 8px;font-size:28px;letter-spacing:-.04em}p{color:#69778d}.notice{margin:18px 0;padding:13px 15px;border-radius:12px;background:#f2f7fc;color:#43546d}.error{background:#fff3f0;color:#9c3526}.success{background:#eaf9f0;color:#276641}label{display:block;margin-top:16px;color:#526177;font-size:13px;font-weight:700}input{width:100%;margin-top:6px;padding:12px;border:1px solid #dfe6ef;border-radius:10px;font:inherit}button,.link{display:inline-flex;justify-content:center;align-items:center;margin-top:20px;padding:12px 17px;border:0;border-radius:999px;background:#73b6e6;color:white;font:inherit;font-weight:750;text-decoration:none;cursor:pointer}small{display:block;margin-top:7px;color:#7b8798;font-weight:400}.brand{margin-bottom:22px;color:#4779b6;font-weight:850;letter-spacing:.1em;font-size:12px}
  </style>
</head>
<body>
  <main class="panel">
    <div class="brand">FLAMEGUARD · PANEL STARTOWY</div>
    <?php if ($complete): ?>
      <h1>Gotowe</h1>
      <p>Utworzono konto administratora. Możesz teraz zalogować się na stronie głównej i zarządzać rozkładem oraz rezerwacjami.</p>
      <div class="notice success">Ze względów bezpieczeństwa usuń lub zmień klucz <code>setup_key</code> w <code>config.php</code>, a następnie usuń z serwera plik <code>setup.php</code>.</div>
      <a class="link" href="flameguard.html">Przejdź do FlameGuard</a>
    <?php elseif ($installed): ?>
      <h1>Instalacja już zakończona</h1>
      <p>Konto administratora zostało już utworzone. Zaloguj się, aby zarządzać systemem.</p>
      <a class="link" href="flameguard.html#login">Zaloguj się</a>
    <?php elseif (isset($pageError)): ?>
      <h1>Konfiguracja wymaga poprawy</h1>
      <div class="notice error"><?= fg_setup_escape($message) ?></div>
      <p>Sprawdź dane bazy w <code>config.php</code> i zaimportuj plik <code>database.sql</code> w phpMyAdmin.</p>
    <?php else: ?>
      <h1>Utwórz administratora</h1>
      <p>Jednorazowy krok konfiguracji współdzielonego systemu rezerwacji FlameGuard.</p>
      <?php if ($message !== ''): ?><div class="notice error"><?= fg_setup_escape($message) ?></div><?php endif; ?>
      <form method="post" autocomplete="off">
        <input type="hidden" name="csrf_token" value="<?= fg_setup_escape(fg_csrf_token()) ?>">
        <label>Klucz instalacyjny<input name="setup_key" type="password" required autocomplete="off"><small>Wpisz tę samą wartość, którą ustawisz w config.php.</small></label>
        <label>Nazwa administratora<input name="username" minlength="3" maxlength="24" pattern="[A-Za-z0-9_]+" required></label>
        <label>Nazwa wyświetlana<input name="display_name" minlength="2" maxlength="80" required></label>
        <label>Hasło administratora<input name="password" type="password" minlength="12" maxlength="200" required autocomplete="new-password"><small>Użyj długiego, unikalnego hasła.</small></label>
        <button type="submit">Utwórz konto</button>
      </form>
    <?php endif; ?>
  </main>
</body>
</html>
