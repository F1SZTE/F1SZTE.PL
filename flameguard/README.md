# FlameGuard — wspólne rezerwacje RP

Pakiet zawiera stronę FlameGuard oraz serwerową aplikację PHP i bazę MySQL/MariaDB. Rezerwacje, konta pasażerów, kursy i zajęte miejsca są zapisywane na serwerze, więc wszyscy użytkownicy widzą ten sam stan.

## Co jest potrzebne

- Hosting obsługujący PHP 8.1 lub nowszy, PDO MySQL oraz MySQL/MariaDB.
- Włączony certyfikat HTTPS dla domeny.
- Dostęp do panelu DirectAdmin i phpMyAdmin.

Hostline podaje obsługę PHP i baz danych w planach hostingu NVMe. Parametry planu i aktywnej wersji PHP sprawdź w panelu Hostline.

## Instalacja na Hostline

1. W DirectAdmin utwórz bazę MySQL oraz użytkownika z pełnymi prawami do tej bazy. Zapisz nazwę bazy, nazwę użytkownika, hasło i host bazy.
2. Otwórz phpMyAdmin, wybierz nową, pustą bazę i zaimportuj `database.sql`.
3. Zmień nazwę `config.php.example` na `config.php`. Wpisz w nim dane bazy oraz ustaw `setup_key` na własny, losowy ciąg o długości co najmniej 32 znaków. Nie publikuj tego klucza.
4. Wgraj zawartość tego folderu do katalogu podstrony FlameGuard (docelowo `public_html/flameguard`). Portfolio F1SZTE zostaje w głównym katalogu, a ikona otwiera `flameguard/flameguard.html`.
5. Otwórz `https://TWOJA-DOMENA/flameguard/setup.php`. Utwórz konto administratora. Użyj unikalnego hasła o długości co najmniej 12 znaków.
6. Po udanej instalacji usuń z serwera `setup.php` i zmień `setup_key` w `config.php` na pustą wartość. Konto administratora zostaje zapisane w bazie.
7. Zaloguj się na stronie i otwórz **Operations**. Dodaj loty i pociągi z datą, godziną, ceną RP oraz liczbą miejsc.
8. Pasażerowie zakładają konta nazwą użytkownika i hasłem — rejestracja nie wymaga e-maila.

## Jak działa rezerwacja

- Pasażer wybiera opublikowany kurs i dostępne miejsce.
- Serwer ponownie sprawdza wolne miejsce przy zapisie, więc dwa konta nie mogą potwierdzić tego samego fotela.
- Pasażer może anulować rezerwację przed odjazdem; zwolnione miejsce wraca do puli.
- „My Bookings” pokazuje wyłącznie rezerwacje zalogowanego konta. Przycisk „View ticket” pobiera PDF z danymi zapisanymi w bazie.
- Ceny są punktami RP. System nie przyjmuje prawdziwych płatności i nie łączy się z przewoźnikami ani rzeczywistymi rozkładami.

## Bezpieczeństwo i kopie

Włącz HTTPS przed przyjmowaniem rejestracji. Hasła są przechowywane jako skróty, a zapisy formularzy są chronione tokenem sesji. Nie przekazuj `config.php` ani haseł administratora innym osobom. Kopie tabel i bazy wykonuj przez phpMyAdmin lub narzędzie backupu Hostline.

## Uwagi

- GitHub Pages nie uruchamia PHP ani MySQL. Ta wersja strony FlameGuard jest przeznaczona do hostingu Hostline, pod ścieżką `/flameguard/`.
- Lista destynacji obejmuje miejsca podane dla FlameGuard RP. Wpisy takie jak Ontario (`ON`) i Stilton (`STI`) są etykietami RP, nie potwierdzonymi kodami lotnisk.
- Rozkład pozostaje pusty do chwili, gdy administrator opublikuje pierwszy kurs.
