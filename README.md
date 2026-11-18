# Bivouac & Camping-car — MVP PWA

## Ce que contient ce dossier
- `index.html` — la page principale (carte)
- `app.js` — toute la logique : carte, recherche OpenStreetMap, spots communautaires (stockés sur le téléphone pour l'instant)
- `manifest.json` — rend l'app installable sur l'écran d'accueil
- `service-worker.js` — fait marcher l'app hors-ligne (sauf la recherche de nouveaux spots, qui a besoin du réseau)
- `icons/` — icônes de l'app

## Déployer sur Vercel (gratuit, ~10 min la première fois)

1. Crée un compte sur https://vercel.com (tu peux te connecter directement avec GitHub).
2. Crée un nouveau dépôt sur https://github.com/new (ex: `bivouac-app`), vide.
3. Sur ton ordinateur, dans le dossier de ce projet :
   ```
   git init
   git add .
   git commit -m "MVP carte bivouac"
   git branch -M main
   git remote add origin https://github.com/TON_COMPTE/bivouac-app.git
   git push -u origin main
   ```
4. Sur vercel.com : "Add New" → "Project" → choisis le dépôt `bivouac-app` → "Deploy".
   Comme ce sont des fichiers statiques (pas de build nécessaire), tu peux laisser les réglages par défaut.
5. Au bout d'une minute, Vercel te donne une URL du type `https://bivouac-app.vercel.app`.
6. Ouvre cette URL sur ton téléphone (Chrome Android ou Safari iPhone) → tu peux l'ajouter à l'écran d'accueil.

À chaque fois que tu modifies le code et que tu fais `git push`, Vercel redéploie automatiquement.

## Tester en local avant de déployer

Depuis ce dossier :
```
python3 -m http.server 8000
```
Puis ouvre `http://localhost:8000` dans ton navigateur. Le bouton "Rechercher dans cette zone" interroge OpenStreetMap en direct.

## Limites actuelles (MVP)
- Les spots ajoutés par un utilisateur ("clic droit sur la carte") ne sont visibles que sur son propre téléphone (stockage local). Pour une vraie couche communautaire partagée entre tous les utilisateurs, il faudra une base de données (prochaine étape : Supabase ou Firebase, gratuits pour démarrer).
- Pas encore d'itinéraire multi-étapes, pas de compte utilisateur, pas de monétisation — prévu pour les étapes suivantes.
