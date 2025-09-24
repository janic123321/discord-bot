// index.js - sauber, emoji-frei, Render-kompatibel

const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');

// === Konfiguration (aus Environment-Variablen) ===
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const ROLE_CHEAP_ID = process.env.ROLE_CHEAP_ID;
const ROLE_EXPENSIVE_ID = process.env.ROLE_EXPENSIVE_ID;
const DISCORD_INVITE_LINK = process.env.DISCORD_INVITE_LINK;
const PURCHASES_FILE = './purchases.json';

// einfache Prüfungen beim Start
if (!DISCORD_TOKEN) console.error('ERROR: DISCORD_TOKEN fehlt');
if (!ROLE_CHEAP_ID) console.error('ERROR: ROLE_CHEAP_ID fehlt');
if (!ROLE_EXPENSIVE_ID) console.error('ERROR: ROLE_EXPENSIVE_ID fehlt');
if (!DISCORD_INVITE_LINK) console.error('ERROR: DISCORD_INVITE_LINK fehlt');

// Hilfsfunktionen: purchases.json laden/speichern
function loadPurchases() {
  try {
    if (!fs.existsSync(PURCHASES_FILE)) return {};
    const raw = fs.readFileSync(PURCHASES_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (e) {
    console.error('Fehler beim Laden der purchases.json:', e);
    return {};
  }
}
function savePurchases(purchases) {
  try {
    fs.writeFileSync(PURCHASES_FILE, JSON.stringify(purchases, null, 2), 'utf8');
  } catch (e) {
    console.error('Fehler beim Schreiben der purchases.json:', e);
  }
}

// Discord-Client
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// Event: Bot ready
client.once('ready', () => {
  console.log(`Bot ist online als ${client.user.tag}`);
});

// Express-App + Webhook
const app = express();
app.use(bodyParser.json());

/*
Expected webhook payloads (flexibel):
- data.discord_id (Discord user ID) OR
- data.discord_username (just username) OR
- data.discord_tag (username#1234)
- data.price  (price in cents or number)
*/
app.post('/gumroad-webhook', async (req, res) => {
  const data = req.body || {};
  console.log('Webhook empfangen:', data);

  // einfache Validierung
  if (!data || (!data.discord_id && !data.discord_username && !data.discord_tag)) {
    return res.status(400).json({ error: 'discord_id oder discord_username oder discord_tag required' });
  }

  // Preis auswerten (robust gegen Strings)
  let price = 0;
  if (data.price !== undefined && data.price !== null) {
    price = Number(data.price);
    if (Number.isNaN(price)) price = 0;
  }

  // Bestimme gewünschte Rolle anhand Preis (anpassbar)
  // Hier: >= 5000 (cents) = expensive, sonst cheap
  const roleId = price >= 5000 ? ROLE_EXPENSIVE_ID : ROLE_CHEAP_ID;

  // Versuche, den Guild-Context zu bekommen
  const guild = client.guilds.cache.first();
  if (!guild) {
    console.error('Kein verfügbarer Guild-Cache. Bot ist in keinem Server oder Guilds noch nicht geladen.');
    // Speichern, damit wir es bei guildMemberAdd nachreichen können
    const purchases = loadPurchases();
    const key = data.discord_id || (data.discord_username || data.discord_tag).toString().toLowerCase();
    purchases[key] = { roleId, price, timestamp: Date.now() };
    savePurchases(purchases);
    return res.json({ message: 'Bot noch nicht bereit, Kauf gespeichert; Invite:' , invite: DISCORD_INVITE_LINK });
  }

  let member = null;

  // 1) Direkt nach ID suchen (best)
  if (data.discord_id) {
    try {
      member = await guild.members.fetch(data.discord_id).catch(() => null);
    } catch (e) {
      member = null;
    }
  }

  // 2) Wenn keine ID: alle Mitglieder fetchen (Achtung: große Server -> benötigt Intent & kann teuer sein)
  if (!member && (data.discord_username || data.discord_tag)) {
    try {
      const all = await guild.members.fetch(); // benötigt GUILD_MEMBERS intent
      const search = (data.discord_tag || data.discord_username).toString().toLowerCase();
      member = all.find(m => {
        const u = m.user;
        if (!u) return false;
        // match username or full tag (username#1234)
        if (u.username && u.username.toLowerCase() === search) return true;
        if (u.tag && u.tag.toLowerCase() === search) return true;
        return false;
      }) || null;
    } catch (e) {
      console.error('Fehler beim Laden aller Mitglieder:', e);
      member = null;
    }
  }

  if (member) {
    // Member vorhanden -> Rolle zuweisen
    try {
      await member.roles.add(roleId);
      console.log(`Rolle ${roleId} an ${member.user.tag} vergeben`);
      return res.json({ message: 'Rolle vergeben' });
    } catch (err) {
      console.error('Fehler beim Rollen vergeben:', err);
      return res.status(500).json({ error: 'Rollen-Vergabe fehlgeschlagen' });
    }
  } else {
    // Member nicht gefunden -> Kauf speichern & Invite zurückgeben
    const purchases = loadPurchases();
    const key = data.discord_id || (data.discord_username || data.discord_tag).toString().toLowerCase();
    purchases[key] = { roleId, price, timestamp: Date.now() };
    savePurchases(purchases);
    console.log(`Kauf gespeichert für ${key}. Invite zurückgegeben.`);
    return res.json({ message: 'Invite gesendet', invite: DISCORD_INVITE_LINK });
  }
});

// Wenn ein neuer Member dem Server beitritt, prüfen wir ob wir einen Eintrag haben
client.on('guildMemberAdd', async (member) => {
  try {
    const purchases = loadPurchases();
    // match nach ID zuerst, dann username/tag
    const keyById = member.id;
    const keyByUsername = member.user.username ? member.user.username.toLowerCase() : null;
    const keyByTag = member.user.tag ? member.user.tag.toLowerCase() : null;

    let entry = purchases[keyById] || (keyByUsername && purchases[keyByUsername]) || (keyByTag && purchases[keyByTag]);

    if (entry && entry.roleId) {
      try {
        await member.roles.add(entry.roleId);
        console.log(`Stored role ${entry.roleId} assigned to ${member.user.tag}`);
        // Eintrag entfernen, damit er nicht erneut verwendet wird
        delete purchases[keyById];
        if (keyByUsername) delete purchases[keyByUsername];
        if (keyByTag) delete purchases[keyByTag];
        savePurchases(purchases);
      } catch (err) {
        console.error('Fehler beim Zuweisen gespeicherter Rolle:', err);
      }
    }
  } catch (e) {
    console.error('Fehler im guildMemberAdd Handler:', e);
  }
});

// Server starten (kein const PORT definieren)
app.listen(process.env.PORT, () => {
  console.log('Webhook-Server läuft auf Port', process.env.PORT);
});

// Discord einloggen (als letzter Schritt)
client.login(DISCORD_TOKEN);

