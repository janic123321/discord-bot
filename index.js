// index.js
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000; // Port für den Webhook-Server

// === Discord Bot Setup ===
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// === Konfiguration ===
const REMOVED = process.env.REMOVED;
const VERIFY_CHANNEL_ID = '1417121308839379107'; // Verify Channel ID
const ROLE_CHEAP_ID = '1399394163254100009';     // Günstige Rolle
const ROLE_EXPENSIVE_ID = '1399394413083627663'; // Teure Rolle

// === Bot-Login ===
client.once('clientReady', () => {
    console.log(`Bot ist online als ${client.user.tag}`);
});

client.login(REMOVED);

// === Webhook Server für Gumroad ===
app.use(bodyParser.json());// === Webhook Route ===
app.post('/gumroad-webhook', async (req, res) => {
    const data = req.body;
    console.log('Webhook von Gumroad empfangen:', data);

    const guild = client.guilds.cache.first(); // Nimmt den ersten Server
    const member = await guild.members.fetch(data.discord_id).catch(() => null);

    if (!member) {
        console.log(`Kein Mitglied mit Discord-ID ${data.discord_id} gefunden.`);
        return res.status(404).send('Member nicht gefunden');
    }

    // Preis-basiertes Rollen-System (Beispiel)
    if (data.price < 4000) { // alles unter 4000 Cent = günstige Rolle
        await member.roles.add(ROLE_CHEAP_ID);
        console.log(`Günstige Rolle an ${member.user.tag} vergeben`);
    } else if (data.price >= 4000) { // alles ab 4000 Cent = teure Rolle
        await member.roles.add(ROLE_EXPENSIVE_ID);
        console.log(`Teure Rolle an ${member.user.tag} vergeben`);
    }

    res.status(200).send('OK');
});

// Server starten
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Webhook-Server läuft auf Port ${PORT}`);
});



app.post('/gumroad-webhook', async (req, res) => {
    const data = req.body;
    console.log('Webhook empfangen:', data);

    const guild = client.guilds.cache.first(); // Nimmt den ersten Server
    const member = await guild.members.fetch(data.discord_id).catch(() => null);

    if (!member) {
        console.log(`Kein Mitglied mit Discord-ID ${data.discord_id} gefunden. Verify nötig.`);
        return res.status(404).send('Member nicht gefunden');
    }

    // Preis prüfen und Rolle vergeben
    if (data.price < 4000) { // alles unter 4000 Cent = günstige Rolle
        await member.roles.add(ROLE_CHEAP_ID);
        console.log(`Günstige Rolle (${ROLE_CHEAP_ID}) an ${member.user.tag} vergeben`);
    } else if (data.price > 4500) { // alles über 4500 Cent = teure Rolle
        await member.roles.add(ROLE_EXPENSIVE_ID);
        console.log(`Teure Rolle (${ROLE_EXPENSIVE_ID}) an ${member.user.tag} vergeben`);
    } else {
        console.log(`Preis ${data.price} liegt zwischen 4000 und 4500 Cent – keine Rolle vergeben`);
    }

    res.status(200).send('OK');
});

// Server starten
app.listen(PORT, () => {
    console.log(`Webhook-Server läuft auf Port ${PORT}`);
});

     // === Webhook Route ===
app.post('/webhook', (req, res) => {
    console.log('Webhook received:', req.body);
    res.sendStatus(200);
});


app.post('/webhook', (req, res) => {
  console.log('Webhook received:', req.body);
  res.sendStatus(200);
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Webhook-Server läuft auf Port ${PORT}`);
});



cd ~/discord-bot



