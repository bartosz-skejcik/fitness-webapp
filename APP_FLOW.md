# 📱 Przepływ aplikacji (App Flow)

## 1. Autentykacja

```
┌─────────────┐
│   Strona    │
│   główna    │──► Sprawdza autentykację
│      /      │
└─────────────┘
      │
      ├──► Zalogowany? ──────► Dashboard
      │
      └──► Nie zalogowany? ──► Login Page
                                    │
                                    ▼
                            [Zaloguj przez Google]
                                    │
                                    ▼
                            Google OAuth Flow
                                    │
                                    ▼
                            Auth Callback
                                    │
                                    ▼
                              Dashboard
```

## 2. Dashboard - Główny ekran

```
┌──────────────────────────────────────┐
│           DASHBOARD                   │
├──────────────────────────────────────┤
│                                       │
│  ┌────────────┬─────────────┬──────┐│
│  │ Rozpocznij │  Szablony   │ Post-││
│  │  trening   │  treningów  │ ępy  ││
│  └────────────┴─────────────┴──────┘│
│                                       │
│  📋 Twoje szablony treningów          │
│  ┌──────────┐ ┌──────────┐          │
│  │ Trening A│ │ Trening B│ ...      │
│  │  (Góra)  │ │  (Nogi)  │          │
│  └──────────┘ └──────────┘          │
│                                       │
│  📊 Ostatnie treningi                 │
│  • Trening A - 10.10.2025 ✓          │
│  • Trening B - 08.10.2025 ✓          │
│  • ...                                │
│                                       │
└──────────────────────────────────────┘
```

## 3. Tworzenie szablonu

```
Nowy szablon
     │
     ▼
┌─────────────────────────┐
│ 1. Nazwa treningu       │
│    "Trening A - Góra"   │
├─────────────────────────┤
│ 2. Typ treningu         │
│    [Góra] Dół Nogi      │
│    Cardio               │
├─────────────────────────┤
│ 3. Opis (opcjonalnie)   │
├─────────────────────────┤
│ 4. Dodaj ćwiczenia      │
│    [+ Dodaj ćwiczenie]  │
│                         │
│    ┌─────────────────┐ │
│    │ Wyciskanie      │ │
│    │ Serie: 3  [Usuń]│ │
│    └─────────────────┘ │
│    ┌─────────────────┐ │
│    │ Pompki          │ │
│    │ Serie: 3  [Usuń]│ │
│    └─────────────────┘ │
└─────────────────────────┘
     │
     ▼
  [Zapisz szablon]
```

## 4. Rozpoczynanie treningu

```
Rozpocznij trening
     │
     ▼
┌─────────────────────────┐
│ Wybierz szablon:        │
│                         │
│ ○ Trening A - Góra      │
│ ○ Trening B - Nogi      │
│ ○ Trening C - Dół       │
│                         │
└─────────────────────────┘
     │
     ▼
  [Start!]
     │
     ▼
  Sesja treningowa
```

## 5. Sesja treningowa (najważniejsza część!)

```
┌──────────────────────────────────────┐
│  Trening A - Góra        [Zakończ]   │
├──────────────────────────────────────┤
│                                       │
│  Lista ćwiczeń:                       │
│  ✓ 1. Wyciskanie  (3/3 serie)        │
│  → 2. Pompki      (1/3 serie) ←──┐   │
│    3. Wiosłowanie (0/3 serie)    │   │
│                                   │   │
│  ┌─────────────────────────────┐ │   │
│  │  POMPKI                     │ │   │
│  │                             │ │   │
│  │  Seria 2                    │ │   │
│  │                             │ │   │
│  │  Powtórzenia:  [12]         │ │ Zoom
│  │  Ciężar (kg):  [0]          │ │ na
│  │  RIR:          [2]          │ │ bieżące
│  │                             │ │ ćwiczenie
│  │  [✓ Potwierdź serię]        │ │   │
│  │                             │ │   │
│  │  ✓ Seria 1 - 10 reps, 0kg   │ │   │
│  │  → Seria 2 - [w trakcie]    │ │   │
│  │    Seria 3 - [oczekuje]     │ │   │
│  └─────────────────────────────┘ │   │
│                                   │   │
│  [1] [2] [3] ← Nawigacja          │   │
│  ✓   →   -    między ćwiczeniami  │   │
│                                   └───┘
└──────────────────────────────────────┘
```

### Workflow podczas treningu:

1. **Wykonujesz ćwiczenie** (np. 12 pompek)
2. **Powiększasz telefon** na to ćwiczenie
3. **Wpisujesz dane**:
    - Reps: 12
    - Weight: 0 (dla pompek)
    - RIR: 2 (mogłeś zrobić jeszcze 2)
4. **Klikasz "Potwierdź serię"** ✓
5. **Seria zmienia kolor na zielony**
6. **Przechodzisz do kolejnej serii** lub ćwiczenia
7. Po wszystkich seriach: **"Zakończ trening"** 🏆

## 6. Statystyki i postępy

```
┌──────────────────────────────────────┐
│           POSTĘPY                     │
├──────────────────────────────────────┤
│                                       │
│  [2 tyg] [1 mies] [3 mies] [1 rok]   │
│                                       │
│  ┌────────┬────────┬────────┬──────┐ │
│  │   15   │  156   │ 23,450 │  42  │ │
│  │Treningi│ Serie  │Objętość│ Min  │ │
│  └────────┴────────┴────────┴──────┘ │
│                                       │
│  📊 Częstotliwość treningów           │
│  ┌─────────────────────────────────┐ │
│  │     ▂▄█▃▅                        │ │
│  │                                  │ │
│  └─────────────────────────────────┘ │
│                                       │
│  📈 Objętość treningowa               │
│  ┌─────────────────────────────────┐ │
│  │         ╱‾‾╲   ╱‾               │ │
│  │       ╱     ╲╱                  │ │
│  └─────────────────────────────────┘ │
│                                       │
└──────────────────────────────────────┘
```

## 7. Struktura danych (uproszczona)

```
Użytkownik
    │
    ├── Exercises (ćwiczenia)
    │   └── "Wyciskanie", "Pompki", etc.
    │
    ├── Workout Templates (szablony)
    │   ├── "Trening A - Góra"
    │   │   ├── Wyciskanie (3 serie)
    │   │   ├── Pompki (3 serie)
    │   │   └── Wiosłowanie (3 serie)
    │   │
    │   └── "Trening B - Nogi"
    │       ├── Przysiady (4 serie)
    │       └── ...
    │
    └── Workout Sessions (sesje)
        ├── "Trening A - 10.10.2025"
        │   ├── Exercise Log: Wyciskanie
        │   │   ├── Set 1: 12 reps, 60kg, RIR 2 ✓
        │   │   ├── Set 2: 10 reps, 60kg, RIR 1 ✓
        │   │   └── Set 3: 8 reps, 60kg, RIR 0 ✓
        │   │
        │   ├── Exercise Log: Pompki
        │   │   └── ...
        │   │
        │   └── ...
        │
        └── "Trening B - 08.10.2025"
            └── ...
```

## Kluczowe punkty UX

1. **Mobile-first**: Duże przyciski, łatwe wpisywanie cyfr
2. **Zoom na ćwiczenie**: Skupienie na jednej rzeczy na raz
3. **Wizualne oznaczenia**: ✓ dla ukończonych, → dla bieżących
4. **Minimalny klik count**: Potwierdź → Następna seria
5. **Auto-nawigacja**: Po ostatniej serii → kolejne ćwiczenie
6. **Wszystko po polsku**: Intuicyjne dla użytkownika

## Schemat kolorów

-   **Góra (upper)**: Niebieski 🔵
-   **Dół (lower)**: Zielony 🟢
-   **Nogi (legs)**: Fioletowy 🟣
-   **Cardio**: Czerwony 🔴
-   **Ukończone**: Zielony gradient ✓
-   **W trakcie**: Niebieski gradient →
-   **Oczekujące**: Szary -
