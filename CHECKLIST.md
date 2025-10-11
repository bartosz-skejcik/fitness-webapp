# ✅ Checklist - Przed pierwszym użyciem

## Konfiguracja środowiska

-   [x] Zainstalowano zależności (`npm install`)
-   [x] Utworzono konto w Supabase
-   [x] Utworzono nowy projekt w Supabase
-   [x] Skopiowano URL projektu i Anon Key
-   [x] Utworzono plik `.env.local` z wartościami:
    -   [x] `NEXT_PUBLIC_SUPABASE_URL`
    -   [x] `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Konfiguracja bazy danych

-   [x] Uruchomiono `npm run migrate`
-   [x] Skopiowano SQL z outputu
-   [x] Otwarto Supabase Dashboard > SQL Editor
-   [x] Wklejono i wykonano SQL
-   [x] Sprawdzono czy tabele zostały utworzone (Tables w lewym menu)

## Konfiguracja Google OAuth

-   [x] Włączono Google provider w Supabase (Authentication > Providers)
-   [x] Skopiowano Callback URL z Supabase
-   [x] Utworzono projekt w Google Cloud Console (lub wybrano istniejący)
-   [x] Utworzono OAuth 2.0 Client ID
-   [x] Dodano Callback URL do Authorized redirect URIs
-   [x] Skopiowano Client ID i Client Secret z Google
-   [x] Wklejono Client ID i Client Secret do Supabase
-   [x] Zapisano konfigurację w Supabase

## Uruchomienie aplikacji

-   [x] Uruchomiono `npm run dev`
-   [x] Otwarto http://localhost:3000
-   [x] Wyświetla się strona logowania
-   [x] Kliknięto "Zaloguj się przez Google"
-   [x] Logowanie przebiegło pomyślnie
-   [x] Przekierowano do dashboardu

## Pierwsze użycie

-   [x] Utworzono pierwszy szablon treningu
-   [x] Dodano kilka ćwiczeń
-   [x] Rozpoczęto pierwszy trening
-   [x] Zalogowano serie (reps, weight, RIR)
-   [x] Zakończono trening
-   [x] Trening widoczny w historii
-   [x] Sprawdzono statystyki w zakładce "Postępy"

## Wszystko działa! 🎉

Jeśli wszystkie checkboxy są zaznaczone, aplikacja jest gotowa do użytku!

## Problemy?

Jeśli coś nie działa, sprawdź:

1. Konsolę przeglądarki (F12) - błędy JavaScript
2. Terminal - błędy serwera
3. Supabase Dashboard > API Docs - czy endpoint działa
4. Supabase Dashboard > Authentication - czy pojawia się użytkownik po logowaniu
5. Supabase Dashboard > Table Editor - czy dane się zapisują

### Najczęstsze problemy

**"Missing Supabase credentials"**

-   Sprawdź `.env.local`
-   Zrestartuj serwer deweloperski

**Błąd podczas logowania**

-   Sprawdź konfigurację Google OAuth
-   Upewnij się, że redirect URL jest poprawny

**"relation does not exist"**

-   Migracje nie zostały zastosowane
-   Uruchom ponownie `npm run migrate` i wykonaj SQL

**Nie widzę swoich danych**

-   Sprawdź czy jesteś zalogowany tym samym kontem
-   Sprawdź RLS policies w Supabase

---

Potrzebujesz pomocy? Sprawdź:

-   `README.md` - pełna dokumentacja
-   `SETUP.md` - szczegółowa instrukcja konfiguracji
-   `PROJECT_SUMMARY.md` - podsumowanie projektu
