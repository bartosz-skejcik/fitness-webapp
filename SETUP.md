# Szybka instrukcja uruchomienia

## Krok po kroku

### 1. Uzupełnij zmienne środowiskowe

Otwórz plik `.env.local` i uzupełnij wartości:

```env
NEXT_PUBLIC_SUPABASE_URL=https://twojprojekt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=twoj_anon_key_z_supabase
```

Gdzie je znaleźć:

-   Zaloguj się do [Supabase](https://supabase.com)
-   Wybierz swój projekt
-   Settings > API
-   Skopiuj "Project URL" i "anon public" key

### 2. Zastosuj migracje bazy danych

#### Metoda 1: Przez Supabase Dashboard (ZALECANE)

```bash
npm run migrate
```

Skopiuj wyświetlony kod SQL i:

1. Otwórz Supabase Dashboard
2. Przejdź do SQL Editor
3. Wklej kod SQL
4. Kliknij "Run"

#### Metoda 2: Przez Supabase CLI

```bash
# Zainstaluj CLI
npm install -g supabase

# Zaloguj się
supabase login

# Połącz projekt
supabase link --project-ref twoj-project-ref

# Zastosuj migracje
supabase db push
```

### 3. Skonfiguruj Google OAuth

1. Przejdź do Supabase Dashboard
2. Authentication > Providers
3. Znajdź "Google" i kliknij "Enable"
4. Skopiuj "Callback URL (for OAuth)"
5. Przejdź do [Google Cloud Console](https://console.cloud.google.com)
6. Stwórz nowy projekt lub wybierz istniejący
7. APIs & Services > Credentials
8. Create Credentials > OAuth 2.0 Client ID
9. Application type: Web application
10. Authorized redirect URIs: wklej Callback URL z Supabase
11. Skopiuj Client ID i Client Secret
12. Wróć do Supabase i wklej Client ID i Client Secret
13. Zapisz

### 4. Uruchom aplikację

```bash
npm run dev
```

Otwórz http://localhost:3000 w przeglądarce.

### 5. Pierwsze użycie

1. Kliknij "Zaloguj się przez Google"
2. Zaloguj się swoim kontem Google
3. Zostaniesz przekierowany do dashboardu
4. Stwórz swój pierwszy szablon treningu:
    - Kliknij "Nowy szablon"
    - Nadaj nazwę (np. "Trening A - Góra")
    - Wybierz typ: Góra/Dół/Nogi/Cardio
    - Dodaj ćwiczenia:
        - Możesz stworzyć nowe (np. "Wyciskanie sztangi")
        - Lub wybrać z listy jeśli już jakieś dodałeś
    - Ustaw liczbę serii (domyślnie 3)
    - Zapisz szablon
5. Rozpocznij trening:
    - Kliknij "Rozpocznij trening"
    - Wybierz szablon
    - Kliknij "Rozpocznij trening"
6. Loguj swoje serie:
    - Dla każdej serii wprowadź:
        - Powtórzenia (np. 10)
        - Ciężar w kg (np. 60)
        - RIR - Reps In Reserve (np. 2)
    - Kliknij "Potwierdź serię"
    - Przejdź do kolejnego ćwiczenia
7. Po ukończeniu - kliknij "Zakończ trening"

## Troubleshooting

### Błąd: "Missing Supabase credentials"

-   Sprawdź czy plik `.env.local` istnieje
-   Sprawdź czy zawiera poprawne wartości
-   Zrestartuj serwer deweloperski (`npm run dev`)

### Błąd podczas logowania

-   Upewnij się, że Google OAuth jest poprawnie skonfigurowane
-   Sprawdź czy redirect URL w Google Cloud Console jest poprawny
-   Sprawdź czy provider Google jest włączony w Supabase

### Błąd "relation does not exist"

-   Migracje nie zostały zastosowane
-   Uruchom `npm run migrate` i zastosuj SQL w Supabase Dashboard

### Brak danych / pusta lista

-   Upewnij się, że jesteś zalogowany
-   Sprawdź RLS policies w Supabase (powinny być automatycznie utworzone przez migrację)
-   Sprawdź konsolę przeglądarki (F12) dla błędów

## Gotowe!

Teraz możesz korzystać z aplikacji do śledzenia swoich treningów! 💪
