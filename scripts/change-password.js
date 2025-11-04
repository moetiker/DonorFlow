#!/usr/bin/env node

/**
 * Script zum Ändern des Benutzer-Passworts
 * Usage: node scripts/change-password.js <username>
 */

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

const prisma = new PrismaClient();

/**
 * Liest Passwort versteckt von stdin
 */
function readPasswordHidden(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Verstecke Eingabe
    process.stdin.on('data', (char) => {
      char = char.toString();
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004': // EOF
          process.stdin.pause();
          break;
        default:
          process.stdout.clearLine();
          process.stdout.cursorTo(0);
          process.stdout.write(prompt);
          break;
      }
    });

    rl.question(prompt, (password) => {
      rl.close();
      console.log(''); // Neue Zeile nach der Eingabe
      resolve(password);
    });

    // Verstecke Input
    rl._writeToOutput = function _writeToOutput(stringToWrite) {
      if (stringToWrite.startsWith(prompt)) {
        rl.output.write(prompt);
      }
    };
  });
}

async function changePassword(username) {
  try {
    // Prüfen ob Benutzer existiert
    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      console.error(`❌ Fehler: Benutzer "${username}" nicht gefunden`);
      process.exit(1);
    }

    console.log(`Benutzer gefunden: ${user.name || username}`);
    console.log('');

    // Passwort zweimal abfragen
    const password1 = await readPasswordHidden('Neues Passwort: ');
    const password2 = await readPasswordHidden('Passwort wiederholen: ');

    // Passwörter vergleichen
    if (password1 !== password2) {
      console.error('❌ Fehler: Passwörter stimmen nicht überein');
      process.exit(1);
    }

    // Passwort-Validierung
    if (password1.length < 6) {
      console.error('❌ Fehler: Passwort muss mindestens 6 Zeichen lang sein');
      process.exit(1);
    }

    // Passwort hashen
    console.log('🔐 Hashe neues Passwort...');
    const passwordHash = await bcrypt.hash(password1, 10);

    // Passwort aktualisieren
    await prisma.user.update({
      where: { username },
      data: { passwordHash }
    });

    console.log(`✅ Passwort erfolgreich geändert für Benutzer: ${username}`);
  } catch (error) {
    console.error('❌ Fehler beim Ändern des Passworts:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Argumente aus Command Line lesen
const args = process.argv.slice(2);

if (args.length !== 1) {
  console.log('Usage: node scripts/change-password.js <username>');
  console.log('');
  console.log('Beispiel:');
  console.log('  node scripts/change-password.js admin');
  process.exit(1);
}

const [username] = args;

// Ausführen
changePassword(username);
