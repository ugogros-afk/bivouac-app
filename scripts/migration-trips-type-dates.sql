-- Ajoute le type de séjour et les dates à un voyage (card #34, "Nouveau voyage",
-- mockup MesItineraires-liste-creation.html, demande du 27/11/2026).
-- Idempotent : peut être rejoué sans erreur si les colonnes existent déjà.

alter table public.trips
  add column if not exists type_sejour text,
  add column if not exists date_start date,
  add column if not exists date_end date;
