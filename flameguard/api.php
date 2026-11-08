<?php
declare(strict_types=1);

try {
    require __DIR__ . '/bootstrap.php';
} catch (Throwable $error) {
    error_log('FlameGuard API bootstrap: ' . $error->getMessage());
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'not_configured']);
    exit;
}

try {
    $pdo = fg_db();
    $action = (string) ($_GET['action'] ?? '');

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if ($action === 'bootstrap') {
            $user = fg_current_user();
            fg_json(['ok' => true, 'csrf' => fg_csrf_token(), 'user' => $user]);
        }

        if ($action === 'places') {
            $kind = (string) ($_GET['kind'] ?? 'flight');
            if (!in_array($kind, ['flight', 'train'], true)) fg_json(['ok' => false, 'error' => 'invalid_type'], 400);
            $field = $kind === 'train' ? 'train_enabled' : 'flight_enabled';
            $places = $pdo->query("SELECT code, place_name, country_name FROM fg_places WHERE {$field} = 1 ORDER BY sort_order, place_name")->fetchAll();
            fg_json(['ok' => true, 'places' => $places]);
        }

        if ($action === 'trips') {
            $kind = (string) ($_GET['kind'] ?? 'flight');
            $origin = strtoupper(trim((string) ($_GET['origin'] ?? '')));
            $destination = strtoupper(trim((string) ($_GET['destination'] ?? '')));
            $date = (string) ($_GET['date'] ?? '');
            if (!in_array($kind, ['flight', 'train'], true) || !preg_match('/^[A-Z0-9]{2,8}$/', $origin) || !preg_match('/^[A-Z0-9]{2,8}$/', $destination) || !fg_valid_date($date)) {
                fg_json(['ok' => false, 'error' => 'invalid_search'], 400);
            }
            $stmt = $pdo->prepare("SELECT t.trip_id, t.travel_type, t.origin_code, o.place_name AS origin_name, t.destination_code, d.place_name AS destination_name, t.operator_name, t.departure_at, t.arrival_at, t.fare_points, t.seat_capacity, GREATEST(t.seat_capacity - COALESCE(SUM(CASE WHEN b.booking_status = 'confirmed' THEN 1 ELSE 0 END), 0), 0) AS seats_left FROM fg_trips t JOIN fg_places o ON o.code = t.origin_code JOIN fg_places d ON d.code = t.destination_code LEFT JOIN fg_bookings b ON b.trip_id = t.trip_id WHERE t.travel_type = ? AND t.trip_status = 'published' AND t.origin_code = ? AND t.destination_code = ? AND DATE(t.departure_at) = ? AND t.departure_at > ? GROUP BY t.trip_id ORDER BY t.departure_at");
            $stmt->execute([$kind, $origin, $destination, $date, date('Y-m-d H:i:s')]);
            $trips = $stmt->fetchAll();
            foreach ($trips as &$trip) {
                $trip['trip_id'] = (int) $trip['trip_id'];
                $trip['fare_points'] = (int) $trip['fare_points'];
                $trip['seat_capacity'] = (int) $trip['seat_capacity'];
                $trip['seats_left'] = (int) $trip['seats_left'];
                $trip['departure_at'] = fg_api_datetime($trip['departure_at']);
                $trip['arrival_at'] = fg_api_datetime($trip['arrival_at']);
            }
            unset($trip);
            fg_json(['ok' => true, 'trips' => $trips]);
        }

        if ($action === 'seats') {
            $tripId = filter_var($_GET['trip_id'] ?? null, FILTER_VALIDATE_INT);
            if (!$tripId || $tripId < 1) fg_json(['ok' => false, 'error' => 'invalid_trip'], 400);
            $stmt = $pdo->prepare('SELECT trip_id, seat_capacity, trip_status FROM fg_trips WHERE trip_id = ? AND departure_at > ?');
            $stmt->execute([$tripId, date('Y-m-d H:i:s')]);
            $trip = $stmt->fetch();
            if (!$trip || $trip['trip_status'] !== 'published') fg_json(['ok' => false, 'error' => 'trip_unavailable'], 404);
            $stmt = $pdo->prepare("SELECT seat_code FROM fg_bookings WHERE trip_id = ? AND booking_status = 'confirmed'");
            $stmt->execute([$tripId]);
            fg_json(['ok' => true, 'capacity' => (int) $trip['seat_capacity'], 'occupied' => array_column($stmt->fetchAll(), 'seat_code')]);
        }

        if ($action === 'bookings') {
            $user = fg_require_user();
            $stmt = $pdo->prepare("SELECT b.booking_id, b.booking_code, b.seat_code, b.fare_points, b.booking_status, b.booked_at, t.travel_type, t.origin_code, o.place_name AS origin_name, t.destination_code, d.place_name AS destination_name, t.operator_name, t.departure_at, t.arrival_at, t.trip_status FROM fg_bookings b JOIN fg_trips t ON t.trip_id = b.trip_id JOIN fg_places o ON o.code = t.origin_code JOIN fg_places d ON d.code = t.destination_code WHERE b.user_id = ? ORDER BY b.booked_at DESC");
            $stmt->execute([$user['id']]);
            $items = $stmt->fetchAll();
            foreach ($items as &$item) {
                $item['booking_id'] = (int) $item['booking_id'];
                $item['fare_points'] = (int) $item['fare_points'];
                $item['departure_at'] = fg_api_datetime($item['departure_at']);
                $item['arrival_at'] = fg_api_datetime($item['arrival_at']);
            }
            unset($item);
            fg_json(['ok' => true, 'bookings' => $items, 'user' => $user]);
        }

        if ($action === 'admin-trips') {
            fg_require_admin();
            $trips = $pdo->query("SELECT t.trip_id, t.travel_type, t.origin_code, o.place_name AS origin_name, t.destination_code, d.place_name AS destination_name, t.operator_name, t.departure_at, t.arrival_at, t.fare_points, t.seat_capacity, t.trip_status, COUNT(CASE WHEN b.booking_status = 'confirmed' THEN 1 END) AS booked_count FROM fg_trips t JOIN fg_places o ON o.code = t.origin_code JOIN fg_places d ON d.code = t.destination_code LEFT JOIN fg_bookings b ON b.trip_id = t.trip_id GROUP BY t.trip_id ORDER BY t.departure_at DESC LIMIT 300")->fetchAll();
            foreach ($trips as &$trip) {
                foreach (['trip_id', 'fare_points', 'seat_capacity', 'booked_count'] as $key) $trip[$key] = (int) $trip[$key];
                $trip['departure_at'] = fg_api_datetime($trip['departure_at']);
                $trip['arrival_at'] = fg_api_datetime($trip['arrival_at']);
            }
            unset($trip);
            fg_json(['ok' => true, 'trips' => $trips]);
        }

        fg_json(['ok' => false, 'error' => 'not_found'], 404);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fg_json(['ok' => false, 'error' => 'method_not_allowed'], 405);
    fg_require_csrf();
    $data = fg_json_body();

    if ($action === 'register') {
        $username = strtolower(trim((string) ($data['username'] ?? '')));
        $displayName = trim((string) ($data['display_name'] ?? ''));
        $password = (string) ($data['password'] ?? '');
        if (!preg_match('/^[a-z0-9_]{3,24}$/', $username)) fg_json(['ok' => false, 'error' => 'invalid_username'], 422);
        if (strlen($displayName) < 2 || strlen($displayName) > 80) fg_json(['ok' => false, 'error' => 'invalid_display_name'], 422);
        if (strlen($password) < 12 || strlen($password) > 200) fg_json(['ok' => false, 'error' => 'weak_password'], 422);
        try {
            $stmt = $pdo->prepare("INSERT INTO fg_users (username, display_name, password_hash, user_role) VALUES (?, ?, ?, 'passenger')");
            $stmt->execute([$username, $displayName, password_hash($password, PASSWORD_DEFAULT)]);
        } catch (PDOException $error) {
            if ((string) $error->getCode() === '23000') fg_json(['ok' => false, 'error' => 'username_taken'], 409);
            throw $error;
        }
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int) $pdo->lastInsertId();
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        fg_json(['ok' => true, 'csrf' => fg_csrf_token(), 'user' => fg_current_user()]);
    }

    if ($action === 'login') {
        $username = strtolower(trim((string) ($data['username'] ?? '')));
        $password = (string) ($data['password'] ?? '');
        $stmt = $pdo->prepare('SELECT user_id, password_hash FROM fg_users WHERE username = ?');
        $stmt->execute([$username]);
        $account = $stmt->fetch();
        if (!$account || !password_verify($password, $account['password_hash'])) fg_json(['ok' => false, 'error' => 'invalid_credentials'], 401);
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int) $account['user_id'];
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        fg_json(['ok' => true, 'csrf' => fg_csrf_token(), 'user' => fg_current_user()]);
    }

    if ($action === 'logout') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires' => time() - 42000,
                'path' => $params['path'],
                'domain' => $params['domain'],
                'secure' => $params['secure'],
                'httponly' => $params['httponly'],
                'samesite' => 'Lax',
            ]);
        }
        session_destroy();
        fg_json(['ok' => true]);
    }

    if ($action === 'create-booking') {
        $user = fg_require_user();
        $tripId = filter_var($data['trip_id'] ?? null, FILTER_VALIDATE_INT);
        $seatCode = strtoupper(trim((string) ($data['seat_code'] ?? '')));
        if (!$tripId || $tripId < 1 || !preg_match('/^[1-9][0-9]{0,2}[A-F]$/', $seatCode)) fg_json(['ok' => false, 'error' => 'invalid_booking'], 422);

        try {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare("SELECT trip_id, seat_capacity, fare_points, trip_status, departure_at FROM fg_trips WHERE trip_id = ? FOR UPDATE");
            $stmt->execute([$tripId]);
            $trip = $stmt->fetch();
            if (!$trip || $trip['trip_status'] !== 'published' || strtotime($trip['departure_at']) <= time()) {
                $pdo->rollBack();
                fg_json(['ok' => false, 'error' => 'trip_unavailable'], 409);
            }
            $seatRow = (int) substr($seatCode, 0, -1);
            $seatColumn = ord(substr($seatCode, -1)) - ord('A');
            $seatIndex = ($seatRow - 1) * 6 + $seatColumn + 1;
            if ($seatIndex > (int) $trip['seat_capacity']) {
                $pdo->rollBack();
                fg_json(['ok' => false, 'error' => 'seat_unavailable'], 409);
            }
            $taken = $pdo->prepare("SELECT booking_id FROM fg_bookings WHERE trip_id = ? AND seat_code = ? AND booking_status = 'confirmed' LIMIT 1");
            $taken->execute([$tripId, $seatCode]);
            if ($taken->fetch()) {
                $pdo->rollBack();
                fg_json(['ok' => false, 'error' => 'seat_taken'], 409);
            }
            $code = 'FG-' . strtoupper(bin2hex(random_bytes(5)));
            $insert = $pdo->prepare("INSERT INTO fg_bookings (booking_code, user_id, trip_id, seat_code, fare_points, booking_status) VALUES (?, ?, ?, ?, ?, 'confirmed')");
            $insert->execute([$code, $user['id'], $tripId, $seatCode, (int) $trip['fare_points']]);
            $bookingId = (int) $pdo->lastInsertId();
            $pdo->commit();

            $stmt = $pdo->prepare("SELECT b.booking_id, b.booking_code, b.seat_code, b.fare_points, b.booking_status, b.booked_at, t.travel_type, t.origin_code, o.place_name AS origin_name, t.destination_code, d.place_name AS destination_name, t.operator_name, t.departure_at, t.arrival_at, t.trip_status FROM fg_bookings b JOIN fg_trips t ON t.trip_id = b.trip_id JOIN fg_places o ON o.code = t.origin_code JOIN fg_places d ON d.code = t.destination_code WHERE b.booking_id = ?");
            $stmt->execute([$bookingId]);
            $booking = $stmt->fetch();
            $booking['departure_at'] = fg_api_datetime($booking['departure_at']);
            $booking['arrival_at'] = fg_api_datetime($booking['arrival_at']);
            fg_json(['ok' => true, 'booking' => $booking]);
        } catch (PDOException $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log('FlameGuard booking: ' . $error->getMessage());
            fg_json(['ok' => false, 'error' => 'booking_failed'], 500);
        }
    }

    if ($action === 'cancel-booking') {
        $user = fg_require_user();
        $bookingId = filter_var($data['booking_id'] ?? null, FILTER_VALIDATE_INT);
        if (!$bookingId || $bookingId < 1) fg_json(['ok' => false, 'error' => 'invalid_booking'], 422);
        $stmt = $pdo->prepare("UPDATE fg_bookings b JOIN fg_trips t ON t.trip_id = b.trip_id SET b.booking_status = 'cancelled' WHERE b.booking_id = ? AND b.user_id = ? AND b.booking_status = 'confirmed' AND t.trip_status = 'published' AND t.departure_at > ?");
        $stmt->execute([$bookingId, $user['id'], date('Y-m-d H:i:s')]);
        if ($stmt->rowCount() !== 1) fg_json(['ok' => false, 'error' => 'cannot_cancel'], 409);
        fg_json(['ok' => true]);
    }

    if ($action === 'admin-create-trip') {
        $admin = fg_require_admin();
        $kind = (string) ($data['travel_type'] ?? '');
        $origin = strtoupper(trim((string) ($data['origin_code'] ?? '')));
        $destination = strtoupper(trim((string) ($data['destination_code'] ?? '')));
        $operator = trim((string) ($data['operator_name'] ?? ''));
        $departure = fg_valid_datetime((string) ($data['departure_at'] ?? ''));
        $arrival = fg_valid_datetime((string) ($data['arrival_at'] ?? ''));
        $fare = filter_var($data['fare_points'] ?? null, FILTER_VALIDATE_INT);
        $capacity = filter_var($data['seat_capacity'] ?? null, FILTER_VALIDATE_INT);
        if (!in_array($kind, ['flight', 'train'], true) || !preg_match('/^[A-Z0-9]{2,8}$/', $origin) || !preg_match('/^[A-Z0-9]{2,8}$/', $destination) || $origin === $destination || strlen($operator) < 2 || strlen($operator) > 80 || !$departure || !$arrival || $arrival <= $departure || $departure <= new DateTimeImmutable() || $fare === false || $fare < 0 || $fare > 1000000 || $capacity === false || $capacity < 1 || $capacity > 300) {
            fg_json(['ok' => false, 'error' => 'invalid_trip'], 422);
        }
        $field = $kind === 'train' ? 'train_enabled' : 'flight_enabled';
        $placeQuery = $pdo->prepare("SELECT code FROM fg_places WHERE code IN (?, ?) AND {$field} = 1");
        $placeQuery->execute([$origin, $destination]);
        if (count($placeQuery->fetchAll()) !== 2) fg_json(['ok' => false, 'error' => 'invalid_places'], 422);
        $stmt = $pdo->prepare("INSERT INTO fg_trips (travel_type, origin_code, destination_code, operator_name, departure_at, arrival_at, fare_points, seat_capacity, trip_status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', ?)");
        $stmt->execute([$kind, $origin, $destination, $operator, $departure->format('Y-m-d H:i:s'), $arrival->format('Y-m-d H:i:s'), $fare, $capacity, $admin['id']]);
        fg_json(['ok' => true, 'trip_id' => (int) $pdo->lastInsertId()]);
    }

    if ($action === 'admin-trip-status') {
        fg_require_admin();
        $tripId = filter_var($data['trip_id'] ?? null, FILTER_VALIDATE_INT);
        $status = (string) ($data['trip_status'] ?? '');
        if (!$tripId || $tripId < 1 || !in_array($status, ['published', 'cancelled'], true)) fg_json(['ok' => false, 'error' => 'invalid_trip'], 422);
        $stmt = $pdo->prepare('UPDATE fg_trips SET trip_status = ? WHERE trip_id = ?');
        $stmt->execute([$status, $tripId]);
        fg_json(['ok' => true]);
    }

    fg_json(['ok' => false, 'error' => 'not_found'], 404);
} catch (Throwable $error) {
    error_log('FlameGuard API error: ' . $error->getMessage());
    fg_json(['ok' => false, 'error' => 'server_error'], 500);
}
