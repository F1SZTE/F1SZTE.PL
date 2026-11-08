-- FlameGuard shared RP booking system
-- Create an empty MySQL/MariaDB database in Hostline, select it in phpMyAdmin,
-- then import this file. Do not import it into a database that has other data.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS fg_app_settings (
  setting_id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  installed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO fg_app_settings (setting_id, installed_at) VALUES (1, NULL);

CREATE TABLE IF NOT EXISTS fg_users (
  user_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(24) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  display_name VARCHAR(80) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  user_role ENUM('passenger', 'admin') NOT NULL DEFAULT 'passenger',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_fg_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fg_places (
  code VARCHAR(8) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL PRIMARY KEY,
  place_name VARCHAR(100) NOT NULL,
  country_name VARCHAR(100) NOT NULL,
  flight_enabled TINYINT(1) NOT NULL DEFAULT 1,
  train_enabled TINYINT(1) NOT NULL DEFAULT 0,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 500,
  KEY idx_fg_places_flight (flight_enabled, sort_order),
  KEY idx_fg_places_train (train_enabled, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO fg_places (code, place_name, country_name, flight_enabled, train_enabled, sort_order) VALUES
('PRG','Praha','Czechy',1,0,10),
('STI','Stilton','Mid-Atlantic RP',1,0,20),
('LAX','Los Angeles','USA',1,0,30),
('LAS','Las Vegas','USA',1,0,40),
('NYC','Nowy Jork','USA',1,0,50),
('ON','Ontario','Kanada',1,0,60),
('MEX','Mexico City','Meksyk',1,0,70),
('WAW','Warszawa','Polska',1,0,80),
('LCJ','Łódź','Polska',1,0,90),
('GDN','Gdańsk','Polska',1,0,100),
('KTW','Katowice','Polska',1,0,110),
('KRK','Kraków','Polska',1,0,120),
('KIX','Osaka','Japonia',1,0,130),
('HND','Tokio','Japonia',1,0,140),
('NRT','Tokio','Japonia',1,0,150),
('MOW','Moskwa','Rosja',1,0,160),
('VVO','Władywostok','Rosja',1,0,170),
('SYD','Sydney','Australia',1,0,180),
('OSL','Oslo','Norwegia',1,0,190),
('VNO','Wilno','Litwa',1,0,200),
('ARN','Sztokholm','Szwecja',1,0,210),
('CPH','Kopenhaga','Dania',1,0,220),
('FCO','Rzym','Włochy',1,0,230),
('PMI','Palma de Mallorca','Hiszpania',1,0,240),
('BCN','Barcelona','Hiszpania',1,0,250),
('CDG','Paryż','Francja',1,0,260),
('LHR','Londyn','Wielka Brytania',1,0,270),
('TLS','Tuluza','Francja',1,0,280),
('BUD','Budapeszt','Węgry',1,0,290),
('BTS','Bratysława','Słowacja',1,0,300),
('DEL','Delhi','Indie',1,0,310),
('BOM','Mumbaj','Indie',1,0,320),
('BKK','Bangkok','Tajlandia',1,0,330),
('SIN','Singapur','Singapur',1,0,340),
('KUL','Kuala Lumpur','Malezja',1,0,350),
('HAN','Hanoi','Wietnam',1,0,360),
('SGN','Ho Chi Minh','Wietnam',1,0,370),
('DPS','Denpasar (Bali)','Indonezja',1,0,380),
('MNL','Manila','Filipiny',1,0,390),
('TPE','Tajpej','Tajwan',1,0,400),
('ICN','Seul','Korea Południowa',1,0,410),
('PVG','Szanghaj','Chiny',1,0,420),
('HKG','Hongkong','Specjalny Region Administracyjny Chin',1,0,430),
('PEK','Pekin','Chiny',1,0,440),
('DXB','Dubaj','Zjednoczone Emiraty Arabskie',1,0,450),
('DOH','Doha','Katar',1,0,460),
('RUH','Rijad','Arabia Saudyjska',1,0,470),
('TLV','Tel Awiw','Izrael',1,0,480),
('IST','Stambuł','Turcja',1,0,490),
('GRU','São Paulo','Brazylia',1,0,500),
('GIG','Rio de Janeiro','Brazylia',1,0,510),
('STC','Stilton Central','Mid-Atlantic RP',0,1,600),
('STA','Stilton Airport','Mid-Atlantic RP',0,1,610);

CREATE TABLE IF NOT EXISTS fg_trips (
  trip_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  travel_type ENUM('flight', 'train') NOT NULL,
  origin_code VARCHAR(8) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  destination_code VARCHAR(8) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  operator_name VARCHAR(80) NOT NULL,
  departure_at DATETIME NOT NULL,
  arrival_at DATETIME NOT NULL,
  fare_points INT UNSIGNED NOT NULL,
  seat_capacity SMALLINT UNSIGNED NOT NULL,
  trip_status ENUM('published', 'cancelled') NOT NULL DEFAULT 'published',
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_fg_trip_search (travel_type, trip_status, departure_at),
  KEY idx_fg_trip_route (origin_code, destination_code, departure_at),
  CONSTRAINT fk_fg_trip_origin FOREIGN KEY (origin_code) REFERENCES fg_places (code),
  CONSTRAINT fk_fg_trip_destination FOREIGN KEY (destination_code) REFERENCES fg_places (code),
  CONSTRAINT fk_fg_trip_creator FOREIGN KEY (created_by) REFERENCES fg_users (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fg_bookings (
  booking_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  booking_code VARCHAR(20) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  trip_id BIGINT UNSIGNED NOT NULL,
  seat_code VARCHAR(5) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  fare_points INT UNSIGNED NOT NULL,
  booking_status ENUM('confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed',
  booked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_fg_booking_code (booking_code),
  KEY idx_fg_booking_seat (trip_id, seat_code, booking_status),
  KEY idx_fg_booking_user (user_id, booked_at),
  CONSTRAINT fk_fg_booking_user FOREIGN KEY (user_id) REFERENCES fg_users (user_id),
  CONSTRAINT fk_fg_booking_trip FOREIGN KEY (trip_id) REFERENCES fg_trips (trip_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
