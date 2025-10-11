# Fitness Tracker - Aplikacja webowa do śledzenia treningów

Aplikacja webowa do organizowania i śledzenia treningów i postępów, zastępująca arkusz Excel bardziej wygodnym i funkcjonalnym rozwiązaniem.

## Funkcjonalności

### Zarządzanie treningami

-   **4 typy treningów**: Góra (upper), Dół (lower), Nogi (legs), Cardio
-   Tworzenie szablonów treningów z własnym zestawem ćwiczeń
-   Rozpoczynanie sesji treningowych na podstawie szablonów
-   Elastyczne dodawanie ćwiczeń do szablonów

### Logowanie treningów

-   Intuicyjny interfejs do wprowadzania danych podczas treningu
-   Zoom na pojedyncze ćwiczenie podczas wykonywania
-   Dla każdej serii:
    -   Liczba powtórzeń (reps)
    -   Ciężar (weight) w kg
    -   RIR (Reps In Reserve)
-   Oznaczanie ukończonych serii
-   Mobilny interfejs przystosowany do użycia na siłowni

### Statystyki i postępy

-   Wykresy postępów:
    -   2 tygodnie
    -   1 miesiąc
    -   3 miesiące
    -   1 rok
-   Statystyki:
    -   Liczba treningów
    -   Całkowita liczba serii
    -   Objętość treningowa (kg × powtórzenia)
    -   Średni czas treningu
-   Wykresy słupkowe częstotliwości treningów
-   Wykresy liniowe objętości treningowej

### Autentykacja

-   Logowanie przez Google OAuth
-   Każdy użytkownik ma własne dane
-   Bezpieczne zarządzanie sesją

## Stack technologiczny

-   **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
-   **Backend**: Supabase (PostgreSQL)
-   **Autentykacja**: Supabase Auth (Google OAuth)
-   **Wykresy**: Recharts
-   **Ikony**: Lucide React
-   **Data**: date-fns

## Konfiguracja projektu

### 1. Instalacja zależności

```bash
npm install
```

### 2. Konfiguracja Supabase

1. Utwórz projekt w [Supabase](https://supabase.com)
2. Skopiuj URL projektu i Anon Key
3. Stwórz plik `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=twój_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=twój_supabase_anon_key
```

### 3. Konfiguracja Google OAuth

1. W panelu Supabase przejdź do: **Authentication > Providers**
2. Włącz Google provider
3. Skonfiguruj OAuth credentials w Google Cloud Console
4. Dodaj redirect URL z Supabase do Google OAuth

### 4. Migracje bazy danych

Istnieją dwa sposoby zastosowania migracji:

#### Opcja A: Supabase Dashboard (zalecane)

1. Uruchom skrypt migracji aby wyświetlić SQL:

```bash
npm run migrate
```

2. Skopiuj wyświetlony kod SQL
3. Wklej go w Supabase Dashboard > SQL Editor
4. Wykonaj zapytanie

#### Opcja B: Supabase CLI

```bash
# Zainstaluj Supabase CLI
npm install -g supabase

# Połącz się z projektem
supabase link --project-ref your-project-ref

# Zastosuj migracje
supabase db push
```

### 5. Uruchomienie aplikacji

```bash
# Tryb deweloperski
npm run dev

# Produkcja
npm run build
npm start
```

Aplikacja będzie dostępna pod adresem: http://localhost:3000

## Struktura bazy danych

### Tabele

-   **exercises** - Lista ćwiczeń (wspólne dla wszystkich treningów)
-   **workout_templates** - Szablony treningów
-   **workout_template_exercises** - Ćwiczenia przypisane do szablonów
-   **workout_sessions** - Sesje treningowe (rzeczywiste treningi)
-   **exercise_logs** - Ćwiczenia wykonane w sesji
-   **set_logs** - Pojedyncze serie z danymi (reps, weight, RIR)

### Row Level Security (RLS)

Wszystkie tabele mają włączone RLS - użytkownicy widzą tylko swoje dane.

## Użytkowanie aplikacji

### Pierwszy raz

1. Zaloguj się przez Google
2. Stwórz szablon treningu:
    - Nadaj nazwę (np. "Trening A - Góra")
    - Wybierz typ treningu
    - Dodaj ćwiczenia (możesz stworzyć nowe lub wybrać istniejące)
    - Ustaw liczbę serii dla każdego ćwiczenia
3. Rozpocznij trening na podstawie szablonu

### Podczas treningu

1. Rozpocznij trening z dashboardu
2. Wybierz szablon lub stwórz własny zestaw ćwiczeń
3. W trakcie treningu:
    - Wybierz ćwiczenie z listy (automatycznie zoom na pierwsze nieukończone)
    - Wprowadź dane dla każdej serii:
        - Liczba powtórzeń
        - Ciężar w kg
        - RIR (0-10)
    - Potwierdź serię
    - Przejdź do kolejnej serii/ćwiczenia
4. Po ukończeniu wszystkich serii - zakończ trening

### Przeglądanie postępów

1. Przejdź do zakładki "Postępy"
2. Wybierz okres czasu (2 tygodnie, 1 miesiąc, 3 miesiące, 1 rok)
3. Zobacz:
    - Statystyki liczbowe
    - Wykres częstotliwości treningów
    - Wykres objętości treningowej

## Skrypty

```json
{
    "dev": "Uruchomienie serwera deweloperskiego",
    "build": "Zbudowanie aplikacji produkcyjnej",
    "start": "Uruchomienie serwera produkcyjnego",
    "lint": "Sprawdzenie kodu",
    "migrate": "Wyświetlenie SQL migracji do zastosowania"
}
```

## Funkcje do rozwoju (opcjonalnie)

-   Eksport danych do CSV/Excel
-   Historia rekordów dla każdego ćwiczenia
-   Notatki do ćwiczeń i treningów
-   Zdjęcia przed/po
-   Planowanie treningów na przyszłość
-   Powiadomienia o treningach
-   Tryb offline z synchronizacją
-   Analiza postępów per ćwiczenie
-   Porównanie objętości między ćwiczeniami

## Wsparcie

W przypadku problemów:

1. Sprawdź czy wszystkie zmienne środowiskowe są ustawione
2. Upewnij się, że migracje zostały zastosowane
3. Sprawdź czy Google OAuth jest poprawnie skonfigurowane
4. Sprawdź logi w konsoli przeglądarki i terminalu

## Licencja

Projekt prywatny - do osobistego użytku.
